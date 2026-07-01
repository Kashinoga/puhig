#!/usr/bin/env node
// Cascade / specificity linter for Pocket Universe.
//
// Flags the bug class behind the cover-footer border issue (_NOTES.md, puhig.css
// ~L702): two rules of EQUAL specificity set the same property on the same
// element, so SOURCE ORDER alone decides the winner. The dangerous sub-case is
// "a later equal-specificity rule re-overrides an earlier reset" (e.g. base
// `.card-footer { border-top: 1px }` clobbering `border-top: none` on the cover
// footer) — reordering the file, or adding a rule below, silently changes paint.
//
// Why runtime, not a static parser: elements here carry multiple BEM classes
// (`card-footer card-footer--cover`), so whether two selectors hit the same
// element can't be decided from the stylesheet alone without huge false-positive
// noise. Instead we render the page and ask the browser, per element, which
// rules truly matched (CDP `CSS.getMatchedStylesForNode`) — ground truth, zero
// overlap guessing.
//
// Scope/limits: only checks elements present in the rendered DOM for the chosen
// --theme state (cover cards, footers, etc. render on load, so the motivating
// bug is covered). Run with --theme dark too for dark-only rules. Shorthand
// expansion covers the reset-prone families (border/outline/margin/padding/
// background/inset/border-radius); other properties compare by exact name.
//
// Usage:
//   node tools/csslint.mjs [--theme light|dark|system] [--sheet puhig.css]
//                          [--all-sheets] [--url <url>] [--json]

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join, basename } from 'node:path';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

// --- specificity: approximate but adequate for this hand-written CSS ---------
function specificity(sel) {
  let s = ` ${sel} `;
  let a = 0, b = 0, c = 0;
  a += (s.match(/#[\w-]+/g) || []).length;
  c += (s.match(/::[\w-]+/g) || []).length;        // pseudo-elements → type
  s = s.replace(/::[\w-]+/g, ' ');
  b += (s.match(/\.[\w-]+/g) || []).length;          // classes
  b += (s.match(/\[[^\]]+\]/g) || []).length;         // attributes
  b += (s.match(/:[\w-]+(\([^)]*\))?/g) || []).length; // pseudo-classes
  s = s.replace(/\.[\w-]+|\[[^\]]+\]|#[\w-]+|:[\w-]+(\([^)]*\))?/g, ' ');
  c += (s.match(/[a-zA-Z][\w-]*/g) || []).length;     // element types
  return { a, b, c };
}
const specKey = (s) => `${s.a},${s.b},${s.c}`;
const specEq = (x, y) => x.a === y.a && x.b === y.b && x.c === y.c;

// --- shorthand expansion for reset-prone families ---------------------------
const SIDES = ['top', 'right', 'bottom', 'left'];
function expandProp(prop) {
  prop = prop.toLowerCase();
  if (prop === 'border') return SIDES.flatMap((s) => ['width', 'style', 'color'].map((p) => `border-${s}-${p}`));
  if (prop === 'border-width' || prop === 'border-style' || prop === 'border-color') {
    const k = prop.split('-')[1];
    return SIDES.map((s) => `border-${s}-${k}`);
  }
  let m;
  if ((m = prop.match(/^border-(top|right|bottom|left)$/))) return ['width', 'style', 'color'].map((p) => `border-${m[1]}-${p}`);
  if (prop === 'margin') return SIDES.map((s) => `margin-${s}`);
  if (prop === 'padding') return SIDES.map((s) => `padding-${s}`);
  if (prop === 'inset') return SIDES.slice();
  if (prop === 'outline') return ['outline-width', 'outline-style', 'outline-color'];
  if (prop === 'border-radius') return ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'];
  if (prop === 'background') return ['background-color', 'background-image', 'background-position', 'background-size', 'background-repeat', 'background-origin', 'background-clip', 'background-attachment'];
  return [prop];
}

const RESET_WORDS = new Set(['none', 'initial', 'unset', 'inherit', 'transparent', 'auto']);
function isReset(value) {
  const v = value.trim().toLowerCase().replace(/\s*!important$/, '');
  if (RESET_WORDS.has(v)) return true;
  if (/^0(px|em|rem|%|vh|vw)?$/.test(v)) return true;
  if (/^(0(px|em|rem|%)?\s+){1,3}0(px|em|rem|%)?$/.test(v)) return true; // 0 0 / 0 0 0 0
  return false;
}

function nodeLabel(n) {
  if (!n) return '?';
  let s = (n.nodeName || 'node').toLowerCase();
  if (n.id) s += `#${n.id}`;
  if (n.class) s += '.' + n.class.trim().split(/\s+/).join('.');
  return s;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const url = a.url || pathToFileURL(join(REPO, 'index.html')).href;
  const theme = a.theme || 'light';
  const sheetFilter = a['all-sheets'] ? null : (a.sheet || 'puhig.css');

  const browser = await chromium.launch();
  const context = await browser.newContext({
    colorScheme: theme === 'dark' ? 'dark' : 'light',
  });
  if (theme === 'light' || theme === 'dark') {
    // Appearance rides window.puhig.store's "hig" area (puhig/<VERSION>/hig/theme);
    // mirror the store VERSION here if it ever bumps.
    await context.addInitScript((t) => localStorage.setItem('puhig/1/hig/theme', t), theme);
  }
  const page = await context.newPage();
  const client = await context.newCDPSession(page);

  // Map styleSheetId → sourceURL; capture BEFORE navigation so we see every sheet.
  const sheetUrl = new Map();
  client.on('CSS.styleSheetAdded', (e) => sheetUrl.set(e.header.styleSheetId, e.header.sourceURL || ''));
  await client.send('DOM.enable');
  await client.send('CSS.enable');

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  // Collect every element node, with a readable label for examples.
  const { root } = await client.send('DOM.getDocument', { depth: -1, pierce: true });
  const elements = [];
  const labelOf = new Map();
  (function walk(node) {
    if (node.nodeType === 1) {
      const attrs = node.attributes || [];
      const info = { nodeName: node.nodeName };
      for (let i = 0; i < attrs.length; i += 2) {
        if (attrs[i] === 'id') info.id = attrs[i + 1];
        if (attrs[i] === 'class') info.class = attrs[i + 1];
      }
      labelOf.set(node.nodeId, info);
      elements.push(node.nodeId);
    }
    (node.children || []).forEach(walk);
    (node.shadowRoots || []).forEach(walk);
    if (node.contentDocument) walk(node.contentDocument);
  })(root);

  const inScope = (id) => {
    const u = sheetUrl.get(id) || '';
    if (!u) return false;                          // skip inline <style> / injected
    if (basename(u) === 'phosphor.css') return false; // third-party icon font
    return sheetFilter ? u.includes(sheetFilter) : true;
  };

  // findings keyed by earlier|later|prop → dedup across many elements
  const findings = new Map();

  for (const nodeId of elements) {
    let res;
    try {
      res = await client.send('CSS.getMatchedStylesForNode', { nodeId });
    } catch { continue; } // node detached mid-walk
    const rules = res.matchedCSSRules || [];

    // atomicProp → contributions on THIS element
    const byProp = new Map();
    rules.forEach((rm, order) => {
      const rule = rm.rule;
      if (rule.origin !== 'regular') return;
      if (!inScope(rule.styleSheetId)) return;
      // effective specificity = max among the selectors that matched this node
      const sels = rule.selectorList.selectors;
      let spec = null;
      for (const idx of rm.matchingSelectors) {
        const sp = specificity(sels[idx].text);
        if (!spec || specKey(sp) > specKey(spec)) spec = sp;
      }
      const selText = rm.matchingSelectors.map((i) => sels[i].text).join(', ');
      const line = (rule.style.range ? rule.style.range.startLine : 0) + 1;
      for (const cp of rule.style.cssProperties) {
        if (cp.disabled || cp.name.startsWith('--')) continue;
        if (cp.range == null && cp.text == null) continue; // skip longhand echoes CDP adds
        const important = /!\s*important/.test(cp.text || '') || cp.important === true;
        for (const atom of expandProp(cp.name)) {
          if (!byProp.has(atom)) byProp.set(atom, []);
          byProp.get(atom).push({ order, spec, important, value: cp.value, reset: isReset(cp.value), selText, line });
        }
      }
    });

    for (const [atom, contribs] of byProp) {
      if (contribs.length < 2) continue;
      for (let i = 0; i < contribs.length; i++) {
        for (let j = i + 1; j < contribs.length; j++) {
          const earlier = contribs[i].order < contribs[j].order ? contribs[i] : contribs[j];
          const later = earlier === contribs[i] ? contribs[j] : contribs[i];
          if (earlier.selText === later.selText) continue;       // same rule, multi-match
          if (!specEq(earlier.spec, later.spec)) continue;        // specificity decides → fine
          if (earlier.important !== later.important) continue;    // importance decides → fine
          if (earlier.value === later.value) continue;            // same value → harmless
          const resetClobber = earlier.reset && !later.reset;
          const key = `${earlier.selText} » ${later.selText} | ${atom}`;
          if (!findings.has(key)) {
            findings.set(key, {
              atom, spec: specKey(earlier.spec),
              earlier: { sel: earlier.selText, line: earlier.line, value: earlier.value },
              later: { sel: later.selText, line: later.line, value: later.value },
              resetClobber, count: 0, example: nodeLabel(labelOf.get(nodeId)),
            });
          }
          findings.get(key).count++;
        }
      }
    }
  }

  await browser.close();

  const all = [...findings.values()].sort((x, y) =>
    (y.resetClobber - x.resetClobber) || (y.count - x.count));

  if (a.json) { console.log(JSON.stringify(all, null, 2)); return; }

  const high = all.filter((f) => f.resetClobber);
  const warn = all.filter((f) => !f.resetClobber);
  const head = `Cascade lint — ${basename(url)} @ ${theme}${sheetFilter ? ` (${sheetFilter})` : ' (all sheets)'}`;
  console.log(head + '\n' + '─'.repeat(head.length));

  const print = (f, tag) => {
    console.log(`\n${tag}  [${f.spec}]  ${f.atom}   ×${f.count} el (e.g. ${f.example})`);
    console.log(`   earlier  L${f.earlier.line}  ${f.earlier.sel}  { …: ${f.earlier.value} }`);
    console.log(`   later    L${f.later.line}  ${f.later.sel}  { …: ${f.later.value} }   ← wins by source order`);
  };
  if (high.length) {
    console.log(`\n● ${high.length} reset re-overridden (a later equal-specificity rule beats an earlier reset):`);
    high.forEach((f) => print(f, '●'));
  } else if (all.length) {
    console.log('\n● 0 reset re-overridden — no later equal-specificity rule beats a reset.');
  }
  // ○ order-fragile is mostly idiomatic base+modifier overrides; collapse unless --fragile.
  if (warn.length) {
    if (a.fragile) {
      console.log(`\n○ ${warn.length} order-fragile (equal specificity, same property — order alone decides):`);
      warn.forEach((f) => print(f, '○'));
    } else {
      console.log(`\n○ ${warn.length} order-fragile (equal specificity, order decides) — pass --fragile to list. Top:`);
      warn.slice(0, 5).forEach((f) =>
        console.log(`   ${f.atom}  [${f.spec}]  ${f.earlier.sel} (L${f.earlier.line}) » ${f.later.sel} (L${f.later.line})  ×${f.count}`));
    }
  }
  if (!all.length) console.log('\n✓ no equal-specificity source-order conflicts found.');
  else console.log(`\n${high.length} reset-clobber, ${warn.length} order-fragile.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
