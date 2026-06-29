#!/usr/bin/env node
// Custom-property (design-token) auditor for Pocket Universe.
//
// Keeps the token layer honest as rows multiply, reconciling the THREE ways a
// token is produced or consumed so neither report lies:
//
//   defined by   • a declaration in a :root/theme rule          (the registry)
//                • inline  style="--x: …"  on an element         (per-instance)
//   consumed by  • var(--x) in any value                        (CSS)
//                • getPropertyValue("--x")            literal    (JS)
//                • getPropertyValue("--"+pfx+"-"+n)   dynamic    (JS ramp read,
//                  e.g. getPrefixedPalette("teal") → --teal-1..7)
//
// Two parsing decisions, each with a reason:
//
//  • DEFINITIONS are parsed by the browser, not regex. Elements here carry BEM
//    modifier classes, so `.panel-frame--flip::after {` and `.btn--filled:hover {`
//    make `--flip`/`--filled` look like token definitions to any text scan (the
//    same trap csslint.mjs documents). The browser's PARSED rule.style holds only
//    real declarations. But file:// external sheets are cross-origin to Chromium
//    (cssRules throws SecurityError), so we re-inject the registry text as a
//    same-origin <style> and read ITS cssRules — the real parser, zero BEM noise,
//    no CORS wall.
//
//  • REFERENCES are scanned statically. `var(--x)` and `getPropertyValue("--x")`
//    are unambiguous tokens that a BEM selector can never imitate, so a text scan
//    over every source file is correct and needs no browser.
//
// Reports:
//   UNDEFINED  var()'d but produced by no definition site        → typo / break
//   ORPHAN     defined in the registry, consumed by nothing       → dead token
//   RAMPS      --base-1..N families with unused stops             → palette gap
//
// Usage:
//   node tools/tokens.mjs [options]
//   npm run tokens
//
// Options:
//   --def <file>   Stylesheet that owns the canonical registry (default: puhig.css)
//   --src <files>  Comma-separated files scanned for var()/inline defs
//                  (default: puhig.css,index.html,wx/wx.css,wx/index.html)
//   --js <files>   Comma-separated JS scanned for getPropertyValue reads
//                  (default: puhig.js,wx/wx.js)
//   --json         Emit findings as JSON
//   --orphans      Show only orphans
//   --undefined    Show only undefined references

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, basename } from 'node:path';

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

function read(rel) {
  try { return readFileSync(resolve(REPO, rel), 'utf8'); }
  catch { return ''; }
}

const DEFAULT_SRC = ['puhig.css', 'index.html', 'wx/wx.css', 'wx/index.html'];
const DEFAULT_JS = ['puhig.js', 'wx/wx.js'];

// --- definitions: real CSS parser via a same-origin injected <style> --------
async function parseRegistry(cssText) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addStyleTag({ content: cssText });
  const defs = await page.evaluate(() => {
    const sheet = document.styleSheets[document.styleSheets.length - 1];
    const names = {};
    // A CSSStyleRule exposes BOTH .style and (for CSS nesting) a possibly-empty
    // .cssRules list — an empty list is truthy, so read .style AND recurse; never
    // treat them as exclusive or every real rule's declarations get skipped.
    const walk = (r) => {
      if (r.style) {
        for (let i = 0; i < r.style.length; i++) {
          const p = r.style[i];
          if (p.startsWith('--') && !(p in names)) names[p] = r.selectorText || '';
        }
      }
      if (r.cssRules) for (const x of r.cssRules) walk(x); // @media/@supports/nested
    };
    for (const r of sheet.cssRules) walk(r);
    return names;
  });
  await browser.close();
  return defs; // { name: selectorText }
}

// --- references: unambiguous static scans -----------------------------------
function scanRefs(srcFiles) {
  const refs = new Map();   // name → Set(files)
  const inlineDefs = new Set();
  for (const f of srcFiles) {
    const text = read(f);
    if (!text) continue;
    for (const m of text.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
      if (!refs.has(m[1])) refs.set(m[1], new Set());
      refs.get(m[1]).add(basename(f));
    }
    // inline per-instance definitions: style="--x: …"
    for (const m of text.matchAll(/style="([^"]*)"/g)) {
      for (const d of m[1].matchAll(/(^|;)\s*(--[a-z0-9-]+)\s*:/g)) inlineDefs.add(d[2]);
    }
  }
  return { refs, inlineDefs };
}

// JS consumption + production:
//   read    getPropertyValue("--x")  literal
//   write   setProperty("--x", …)    → a runtime definition site (e.g. --delay)
//   dynamic getPropertyValue("--"+…) → ramp reads exist; enables word matching
function scanJs(jsFiles) {
  const literal = new Set();
  const set = new Set();
  const words = new Set();
  let dynamic = false;
  for (const f of jsFiles) {
    const text = read(f);
    if (!text) continue;
    for (const m of text.matchAll(/getPropertyValue\(\s*['"`](--[a-z0-9-]+)['"`]/g)) literal.add(m[1]);
    for (const m of text.matchAll(/setProperty\(\s*['"`](--[a-z0-9-]+)['"`]/g)) set.add(m[1]);
    if (/getPropertyValue\(\s*['"`]--['"`]\s*\+/.test(text)) dynamic = true;
    for (const m of text.matchAll(/['"`]([a-z][a-z0-9-]{1,20})['"`]/gi)) words.add(m[1].toLowerCase());
  }
  return { literal, set, words, dynamic };
}

const rampOf = (name) => {
  const m = name.match(/^(--.*?)-(\d+)$/);
  return m ? { base: m[1], n: Number(m[2]) } : null;
};

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const defFile = a.def || 'puhig.css';
  const srcFiles = (a.src ? a.src.split(',') : DEFAULT_SRC).map((s) => s.trim());
  const jsFiles = (a.js ? a.js.split(',') : DEFAULT_JS).map((s) => s.trim());

  const registryMap = await parseRegistry(read(defFile));
  const registry = Object.keys(registryMap);
  const { refs, inlineDefs } = scanRefs(srcFiles);
  const { literal, set, words, dynamic } = scanJs(jsFiles);

  const definedAnywhere = new Set([...registry, ...inlineDefs, ...set]);

  // ramp bases consumed dynamically: name appears as a JS word literal AND the
  // codebase has at least one dynamic getPropertyValue read.
  const consumedRampBases = new Set();
  if (dynamic) {
    for (const name of registry) {
      const r = rampOf(name);
      if (r && words.has(r.base.replace(/^--/, ''))) consumedRampBases.add(r.base);
    }
  }

  const isConsumed = (name) => {
    if (refs.has(name) || literal.has(name)) return true;
    const r = rampOf(name);
    return !!(r && consumedRampBases.has(r.base));
  };

  const undef = [...refs.keys()].filter((n) => !definedAnywhere.has(n)).sort();
  const orphans = registry.filter((n) => !isConsumed(n)).sort();

  // line lookup for display (name is ground-truth; just locate it)
  const defLines = read(defFile).split('\n');
  const lineOf = (n) => { const i = defLines.findIndex((l) => l.includes(n + ':')); return i >= 0 ? i + 1 : '?'; };

  // ramp roll-up
  const rampMap = new Map();
  for (const n of registry) {
    const r = rampOf(n);
    if (!r) continue;
    if (!rampMap.has(r.base)) rampMap.set(r.base, { stops: new Set(), orphan: new Set() });
    rampMap.get(r.base).stops.add(r.n);
    if (!isConsumed(n)) rampMap.get(r.base).orphan.add(r.n);
  }
  const ramps = [...rampMap.entries()]
    .map(([base, v]) => ({
      base, consumed: consumedRampBases.has(base),
      stops: [...v.stops].sort((x, y) => x - y),
      orphan: [...v.orphan].sort((x, y) => x - y),
    }))
    .filter((r) => r.orphan.length)
    .sort((x, y) => x.base.localeCompare(y.base));

  if (a.json) {
    console.log(JSON.stringify({ undefined: undef, orphans, ramps, consumedRampBases: [...consumedRampBases] }, null, 2));
    return;
  }

  const head = `Token audit — registry ${defFile}  (${registry.length} defined, ${refs.size} var-referenced)`;
  console.log(head + '\n' + '─'.repeat(head.length));

  if (!a.undefined) {
    const rampBases = new Set(ramps.map((r) => r.base));
    const flat = orphans.filter((o) => { const r = rampOf(o); return !(r && rampBases.has(r.base)); });
    console.log(`\n○ ${orphans.length} ORPHAN — in ${basename(defFile)}, consumed by no var()/JS read:`);
    for (const r of ramps) {
      const tag = r.consumed ? ' (ramp read dynamically; these stops still unused)' : '';
      console.log(`   ${r.base}-[${r.stops.join('')}]${tag}  →  ${r.orphan.map((n) => `${r.base}-${n}`).join(', ')}`);
    }
    for (const o of flat) console.log(`   ${o}   (L${lineOf(o)})`);
    if (!orphans.length) console.log('   (none — every registry token is consumed)');
  }

  if (!a.orphans) {
    console.log(`\n● ${undef.length} UNDEFINED — var() resolving to no definition:`);
    for (const u of undef) console.log(`   ${u}   ← ${[...refs.get(u)].join(', ')}`);
    if (!undef.length) console.log('   (none — every var() resolves)');
  }

  console.log(
    `\n${undef.length} undefined, ${orphans.length} orphan` +
    (consumedRampBases.size ? `  ·  ramps read via JS: ${[...consumedRampBases].join(', ')}` : ''));
  if (undef.length) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exit(1); });
