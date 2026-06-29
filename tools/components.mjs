#!/usr/bin/env node
// Component-contract / consumer-drift checker for Pocket Universe.
//
// Now that wx/ (and anything built on the framework) hand-assembles component
// markup, a class renamed or dropped in puhig.css breaks the consumer silently —
// no error, just unstyled markup. This catches that drift.
//
// Drift is judged against the SANCTIONED VOCABULARY, not just "has a CSS rule":
// many framework classes are deliberately unstyled semantic hooks (.card-language,
// .card-author …) that the catalogue itself renders. So a consumer class is fine
// if it is either styled by a stylesheet OR present in the reference (index.html)
// DOM — the canonical usage. DRIFT is a class the consumer renders that is NEITHER
// styled NOR used by the reference: a typo, a stale rename, or a consumer-only
// class worth a second look. The report also prints the framework surface the
// consumer leans on, so a framework dev can see "touch these and wx/ feels it."
//
// Read from the LIVE DOM, not the source. wx.js builds cards from concatenated
// JS template strings (`class="card-sleeve' + (rowStart ? …)`), which defeats
// static class extraction. Rendering the page and triggering its dynamic content
// gives the real, fully-resolved classList on every element — ground truth, the
// same reason csslint.mjs/tokens.mjs go through the browser. Definitions come from
// each stylesheet injected as a same-origin <style> (file:// sheets are CORS-
// blocked for cssRules), parsed for class tokens in selectorText.
//
// Usage:
//   node tools/components.mjs [options]
//   npm run components -- --consumer wx/index.html --trigger '#wx-cached'
//
// Options:
//   --consumer <url|path>  Page whose DOM classes are checked (default: wx/index.html)
//   --reference <url|path> Canonical usage; its DOM classes count as sanctioned
//                          even when unstyled (default: index.html). Pass 'none'
//                          to judge drift purely on stylesheet definitions.
//   --sheets <files>       Comma-separated stylesheets that DEFINE classes
//                          (default: puhig.css,wx/wx.css,phosphor.css)
//   --trigger <css>        Click this before reading the DOM, to populate dynamic
//                          content (e.g. '#wx-cached' deals the cached fixture)
//   --framework <file>     Which sheet is "the framework" for the dependency
//                          surface report (default: puhig.css)
//   --deps                 List the full framework dependency surface
//   --wait <ms>            Settle delay after load/trigger (default: 600)
//   --json                 Emit findings as JSON

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
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

const read = (rel) => { try { return readFileSync(resolve(REPO, rel), 'utf8'); } catch { return ''; } };
const asUrl = (s) => (/^[a-z]+:\/\//.test(s) ? s : pathToFileURL(resolve(REPO, s)).href);

// Defined classes per sheet: inject the text same-origin and read selectorText
// from the real parser (BEM modifiers like .btn--filled stay intact as classes).
async function definedClasses(page, sheets) {
  const bySheet = {};
  for (const f of sheets) {
    const css = read(f);
    if (!css) { bySheet[basename(f)] = []; continue; }
    await page.addStyleTag({ content: css });
    const classes = await page.evaluate(() => {
      const sheet = document.styleSheets[document.styleSheets.length - 1];
      const found = new Set();
      const walk = (r) => {
        if (r.selectorText) for (const m of r.selectorText.matchAll(/\.(-?[_a-z][\w-]*)/gi)) found.add(m[1]);
        if (r.cssRules) for (const x of r.cssRules) walk(x);
      };
      for (const r of sheet.cssRules) walk(r);
      return [...found];
    });
    bySheet[basename(f)] = classes;
  }
  return bySheet; // { 'puhig.css': [...], ... }
}

// Used classes from the live DOM, with a count and one example element label.
async function usedClasses(page) {
  return page.evaluate(() => {
    const used = {};
    for (const el of document.querySelectorAll('*')) {
      if (!el.classList.length) continue;
      const label = el.nodeName.toLowerCase() +
        (el.id ? `#${el.id}` : '') + '.' + [...el.classList].join('.');
      for (const c of el.classList) {
        if (!used[c]) used[c] = { count: 0, example: label };
        used[c].count++;
      }
    }
    return used;
  });
}

// Load a page (optionally clicking a trigger) and return its live DOM classes.
async function domClasses(browser, url, trigger, wait) {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  if (trigger) {
    const t = page.locator(trigger).first();
    if (await t.count()) await t.click();
  }
  await page.waitForTimeout(wait);
  const used = await usedClasses(page);
  return { page, used };
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const consumer = a.consumer || 'wx/index.html';
  const reference = a.reference || 'index.html';
  const useRef = reference !== 'none';
  const sheets = (a.sheets ? a.sheets.split(',') : ['puhig.css', 'wx/wx.css', 'phosphor.css']).map((s) => s.trim());
  const frameworkBase = basename(a.framework || 'puhig.css');
  const wait = Number(a.wait ?? 600);

  const browser = await chromium.launch();
  const { page, used } = await domClasses(browser, asUrl(consumer), a.trigger, wait);
  const defs = await definedClasses(page, sheets); // inject AFTER the DOM read
  const refClasses = useRef
    ? new Set(Object.keys((await domClasses(browser, asUrl(reference), null, wait)).used))
    : new Set();
  await browser.close();

  const definedAll = new Set(Object.values(defs).flat());
  const frameworkSet = new Set(defs[frameworkBase] || []);
  // sanctioned = styled by any sheet, or rendered by the reference implementation.
  const sanctioned = (c) => definedAll.has(c) || refClasses.has(c);

  // DRIFT: rendered by the consumer, neither styled nor used by the reference.
  const drift = Object.entries(used)
    .filter(([c]) => !sanctioned(c))
    .map(([c, v]) => ({ cls: c, ...v }))
    .sort((x, y) => y.count - x.count);

  // dependency surface: framework classes this consumer leans on.
  const deps = Object.entries(used)
    .filter(([c]) => frameworkSet.has(c))
    .map(([c, v]) => ({ cls: c, count: v.count }))
    .sort((x, y) => y.count - x.count || x.cls.localeCompare(y.cls));

  if (a.json) {
    console.log(JSON.stringify({ drift, deps, sheets: Object.fromEntries(Object.entries(defs).map(([k, v]) => [k, v.length])) }, null, 2));
    if (drift.length) process.exitCode = 1;
    return;
  }

  const refNote = useRef ? `, ref ${reference}` : '';
  const head = `Component contract — ${consumer} vs ${sheets.map((s) => basename(s)).join(', ')}${refNote}`;
  console.log(head + '\n' + '─'.repeat(head.length));

  console.log(`\n● ${drift.length} DRIFT — class the consumer renders, neither styled nor in the reference (typo / renamed / consumer-only):`);
  for (const d of drift) console.log(`   .${d.cls}   ×${d.count}   (e.g. ${d.example})`);
  if (!drift.length) console.log('   (none — every class the consumer renders is defined)');

  console.log(`\n○ dependency surface — ${deps.length} ${frameworkBase} class(es) this consumer relies on:`);
  if (a.deps) {
    for (const d of deps) console.log(`   .${d.cls} ×${d.count}`);
  } else {
    console.log('   ' + deps.slice(0, 12).map((d) => `.${d.cls}`).join(', ') + (deps.length > 12 ? `, … (--deps for all)` : ''));
  }

  console.log(`\n${drift.length} drift, ${deps.length} framework dependencies.`);
  if (drift.length) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exit(1); });
