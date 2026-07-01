#!/usr/bin/env node
// WCAG text-contrast checker for Pocket Universe.
//
// The catalogue re-litigates AA by hand on every component ("clears AA",
// "AA-safe --orange-deep", "deepen on hover to hold contrast"). This renders the
// page and measures it instead: for every text-bearing element it computes the
// real foreground colour and the effective background (compositing rgba layers
// up the ancestor chain), then the WCAG 2.x contrast ratio, and flags anything
// below threshold — in BOTH themes.
//
// Why runtime: only the browser knows the cascaded, theme-resolved colours and
// the real stacking of backgrounds. Reuses the theme-injection trick from
// screenshot.mjs so the page boots straight into light or dark.
//
// Thresholds (WCAG AA): 4.5:1 normal text, 3:1 large text (>=24px, or >=18.66px
// when bold). Pass --aaa for 7:1 / 4.5:1.
//
// Indeterminate by design: text sitting on a gradient or image background
// (mosaic art, --grain) has no single bg colour, so its ratio can't be computed.
// Those are COUNTED and skippable-listed, never silently passed.
//
// Usage:
//   node tools/contrast.mjs [options]
//   npm run contrast -- --theme dark
//
// Options:
//   --url <url>     Page to load            (default: file://<repo>/index.html)
//   --theme <t>     light | dark | system   (default: light)
//   --both          Run light AND dark, combined report
//   --aaa           Use AAA thresholds (7:1 / 4.5:1)
//   --selector <s>  Restrict to text within this subtree
//   --show-indet    List indeterminate (image/gradient bg) elements too
//   --json          Emit findings as JSON

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

// The measurement runs IN the page (needs getComputedStyle + live DOM). It
// returns plain data; all ratio maths is duplicated below for the Node side so
// the page payload stays small and dependency-free.
function collectInPage(selector) {
  const root = selector ? document.querySelector(selector) : document.body;
  if (!root) return [];

  // Resolve ANY CSS colour (named, hex, rgb, hsl, oklch, color()) to real sRGB
  // bytes by painting it on a canvas and reading the pixel back. Regex-parsing
  // only rgb() silently dropped every oklch() surface — and the whole mosaic
  // palette is oklch — so dark art read as the light card beneath it. The
  // browser's own rasteriser has no such blind spot. Straight (un-premultiplied)
  // alpha: one fillRect of rgba(...) on a cleared canvas reads back exactly.
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const colorCache = new Map();
  const toRGBA = (str) => {
    if (!str || str === 'transparent' || str === 'none') return { r: 0, g: 0, b: 0, a: 0 };
    if (colorCache.has(str)) return colorCache.get(str);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = str; // invalid string leaves fillStyle as #000 — harmless
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const c = { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    colorCache.set(str, c);
    return c;
  };
  const over = (fg, bg) => ({ // composite fg (straight alpha) over opaque bg
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
  });

  // Effective background: walk ancestors compositing colour layers until opaque.
  // Returns null if a layer carries an image/gradient (indeterminate by design).
  const effectiveBg = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; // art/gradient
      const c = toRGBA(cs.backgroundColor);
      if (c.a > 0) layers.push(c);
      if (c.a >= 1) break; // fully opaque layer seals the stack
    }
    let acc = { r: 255, g: 255, b: 255 }; // white page under everything
    for (let i = layers.length - 1; i >= 0; i--) acc = over(layers[i], acc);
    return acc;
  };

  const hasDirectText = (el) =>
    [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length);

  const out = [];
  const walk = (el) => {
    const cs = getComputedStyle(el);
    const visible = cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity !== 0;
    if (visible && hasDirectText(el)) {
      let fg = toRGBA(cs.color);
      const bg = effectiveBg(el);
      // translucent text reads against whatever is behind it
      if (fg.a < 1 && bg) fg = { ...over(fg, bg), a: 1 };
      const size = parseFloat(cs.fontSize);
      const bold = +cs.fontWeight >= 700;
      const label =
        el.nodeName.toLowerCase() +
        (el.id ? `#${el.id}` : '') +
        (el.className && typeof el.className === 'string'
          ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
          : '');
      const sample = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 32);
      out.push({ label, sample, size, bold, fg, bg });
    }
    if (visible) for (const c of el.children) walk(c);
  };
  walk(root);
  return out;
}

// --- WCAG ratio maths (Node side) ------------------------------------------
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
const ratio = (a, b) => {
  const L1 = lum(a), L2 = lum(b);
  const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
};
const isLarge = (size, bold) => size >= 24 || (bold && size >= 18.66);

async function runTheme(theme, o) {
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
  await page.goto(o.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const raw = await page.evaluate(collectInPage, o.selector || null);
  await browser.close();

  const need = o.aaa ? { normal: 7, large: 4.5 } : { normal: 4.5, large: 3 };
  // Dedupe by colour-pair + threshold class: one failing combination repeated
  // across 50 saga-markers is ONE finding ×50, not 50 (mirrors csslint's roll-up).
  const groups = new Map();
  let indet = 0, checked = 0;
  const indetList = [];
  for (const r of raw) {
    if (!r.fg) continue;
    if (!r.bg) { indet++; if (o.showIndet) indetList.push(r); continue; }
    checked++;
    const cr = ratio(r.fg, r.bg);
    const large = isLarge(r.size, r.bold);
    const threshold = large ? need.large : need.normal;
    if (cr >= threshold) continue;
    const key = `${hex(r.fg)}|${hex(r.bg)}|${large}`;
    if (!groups.has(key)) {
      groups.set(key, { fg: r.fg, bg: r.bg, cr, threshold, large, count: 0, examples: [] });
    }
    const g = groups.get(key);
    g.count++;
    if (g.examples.length < 3) g.examples.push({ label: r.label, sample: r.sample });
  }
  const fails = [...groups.values()].sort((a, b) => a.cr - b.cr);
  return { theme, fails, indet, checked, indetList };
}

const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

function printReport(results, o) {
  if (o.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }
  for (const res of results) {
    const head = `Contrast — ${basename(o.url)} @ ${res.theme}  ${o.aaa ? '(AAA)' : '(AA)'}  ` +
      `${res.checked} checked, ${res.indet} indeterminate`;
    console.log('\n' + head + '\n' + '─'.repeat(head.length));
    if (!res.fails.length) {
      console.log('✓ no contrast failures.');
    } else {
      const els = res.fails.reduce((n, f) => n + f.count, 0);
      console.log(`● ${res.fails.length} failing colour-pair(s) across ${els} element(s):`);
      for (const f of res.fails) {
        console.log(
          `   ${f.cr.toFixed(2)}:1 < ${f.threshold}  ${hex(f.fg)} on ${hex(f.bg)}` +
          `  ${f.large ? '[large] ' : ''}×${f.count}  (e.g. ${f.examples[0].label})`);
        console.log(`        “${f.examples[0].sample}”`);
      }
    }
    if (o.showIndet && res.indetList.length) {
      console.log(`\n  indeterminate (image/gradient bg — check by eye):`);
      for (const r of res.indetList) console.log(`   ${r.label}  “${r.sample}”`);
    }
  }
  const total = results.reduce((n, r) => n + r.fails.length, 0);
  console.log(`\n${total} failure(s) across ${results.length} theme(s).`);
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const o = {
    url: a.url || pathToFileURL(join(REPO, 'index.html')).href,
    theme: a.theme || 'light',
    aaa: !!a.aaa,
    selector: a.selector,
    showIndet: !!a['show-indet'],
    json: !!a.json,
  };
  const themes = a.both ? ['light', 'dark'] : [o.theme];
  const results = [];
  for (const t of themes) results.push(await runTheme(t, o));
  printReport(results, o);
  if (results.some((r) => r.fails.length)) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exit(1); });
