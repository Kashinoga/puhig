#!/usr/bin/env node
// Deterministic screenshot helper for Pocket Universe.
//
// Captures index.html (or any URL) at an exact CSS viewport, with theme/state
// injected before page scripts run, optionally clipped to one element, and
// optionally diffed against a baseline. Replaces guess-and-check
// `chrome --headless --screenshot` runs.
//
// Why Playwright: its `viewport` sets a TRUE CSS viewport, so full-width cards
// no longer overflow the capture (the `--window-size` artifact noted in
// _NOTES.md → "Testing caveat"). Absolute does-it-fit checks are valid here.
//
// Usage:
//   node tools/screenshot.mjs [options]
//   npm run shot -- [options]
//
// Options:
//   --url <url>          Page to load        (default: file://<repo>/index.html)
//   --out <path>         Output PNG          (default: tools/shots/<auto>.png)
//   --width <px>         CSS viewport width  (default: 1280)
//   --height <px>        CSS viewport height (default: 900)
//   --dpr <n>            Device scale factor (default: 2)
//   --theme <t>          Appearance: light | dark | system   (default: system)
//   --color-scheme <cs>  OS scheme to emulate for `system`: light | dark
//   --ui-theme <name>    puhig-ui-theme value (default: app default)
//   --bg <name>          puhig-bg value       (default: app default)
//   --selector <css>     Clip to this element's bounding box
//   --browser <b>        chromium | firefox | webkit          (default: chromium)
//   --mobile             Emulate touch + mobile (chromium only)
//   --full               Full-page screenshot (ignored if --selector set)
//   --wait <ms>          Settle delay after load for animations (default: 500)
//   --seed <n>           Seed Math.random for reproducible mosaics (see note)
//   --diff <baseline>    Compare result to baseline.png via ImageMagick `compare`
//
// Note on --seed: the mosaics call Math.random() for tile shuffle/colors/seeds,
// so two normal loads never match pixel-for-pixel. Pass the SAME --seed to a
// baseline and a candidate to make before/after diffs meaningful. Without it,
// diffs only make sense on regions that hold no mosaic art.
//
// Examples:
//   node tools/screenshot.mjs --theme dark --selector ".card-sleeve"
//   node tools/screenshot.mjs --width 390 --mobile --out tools/shots/iphone.png
//   node tools/screenshot.mjs --seed 1 --out a.png   # then re-run after a change
//   node tools/screenshot.mjs --seed 1 --diff a.png  # deterministic diff

import { chromium, firefox, webkit } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// --- tiny arg parser: `--key value` pairs and `--flag` booleans ------------
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

// --- map a theme/state set to the localStorage the app reads on load -------
// Mirrors puhig.js: puhig-theme (light|dark, removed for system),
// puhig-ui-theme, puhig-bg. Setting these before scripts run makes the page
// boot straight into the target state — no click simulation, no test-file hack.
function storageFor({ theme, uiTheme, bg }) {
  const store = {};
  if (theme === 'light' || theme === 'dark') store['puhig-theme'] = theme;
  if (uiTheme) store['puhig-ui-theme'] = uiTheme;
  if (bg) store['puhig-bg'] = bg;
  return store;
}

function browserFor(name) {
  return { chromium, firefox, webkit }[name] || chromium;
}

function autoName(o) {
  const parts = ['shot', o.theme, `${o.width}x${o.height}`, o.browser];
  if (o.mobile) parts.push('mobile');
  return parts.join('-') + '.png';
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const o = {
    url: a.url || pathToFileURL(join(REPO, 'index.html')).href,
    width: Number(a.width || 1280),
    height: Number(a.height || 900),
    dpr: Number(a.dpr || 2),
    theme: a.theme || 'system',
    colorScheme: a['color-scheme'],
    uiTheme: a['ui-theme'],
    bg: a.bg,
    selector: a.selector,
    browser: a.browser || 'chromium',
    mobile: !!a.mobile,
    full: !!a.full,
    wait: Number(a.wait ?? 500),
    seed: a.seed !== undefined ? Number(a.seed) : undefined,
    diff: a.diff,
  };
  o.out = a.out
    ? resolve(a.out)
    : join(REPO, 'tools', 'shots', autoName(o));

  mkdirSync(dirname(o.out), { recursive: true });

  // Resolve which OS scheme the media query should see. Explicit light/dark
  // already force [data-theme]; `system` falls through to this emulation.
  const colorScheme =
    o.theme === 'dark' ? 'dark'
    : o.theme === 'light' ? 'light'
    : (o.colorScheme || 'light');

  const browser = await browserFor(o.browser).launch();
  const context = await browser.newContext({
    viewport: { width: o.width, height: o.height },
    deviceScaleFactor: o.dpr,
    colorScheme,
    hasTouch: o.mobile,
    isMobile: o.mobile && o.browser === 'chromium',
  });

  // Seed Math.random before any page script runs, so mosaic shuffle/colors are
  // reproducible across runs and before/after diffs are meaningful. mulberry32.
  if (o.seed !== undefined) {
    await context.addInitScript((seed) => {
      let s = seed >>> 0;
      Math.random = function () {
        s |= 0; s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }, o.seed);
  }

  const store = storageFor(o);
  if (Object.keys(store).length) {
    await context.addInitScript((s) => {
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    }, store);
  }

  const page = await context.newPage();
  await page.goto(o.url, { waitUntil: 'networkidle' });
  if (o.wait) await page.waitForTimeout(o.wait);

  if (o.selector) {
    const el = page.locator(o.selector).first();
    await el.waitFor({ state: 'visible' });
    await el.screenshot({ path: o.out });
  } else {
    await page.screenshot({ path: o.out, fullPage: o.full });
  }

  await browser.close();
  console.log(`✓ ${o.out}  (${o.width}x${o.height} @${o.dpr}x, ${o.theme}, ${o.browser}${o.selector ? `, clip ${o.selector}` : ''})`);

  if (o.diff) runDiff(resolve(o.diff), o.out);
}

// --- visual diff via ImageMagick (no JS image deps) ------------------------
// Writes <out>.diff.png and prints the absolute-error pixel count. Nonzero
// exit from `compare` is expected when images differ — we read its metric.
function runDiff(baseline, current) {
  const diffOut = current.replace(/\.png$/, '.diff.png');
  try {
    const res = execFileSync(
      'compare',
      ['-metric', 'AE', baseline, current, diffOut],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    console.log(`✓ diff: 0 pixels differ vs ${baseline}`);
    return res;
  } catch (e) {
    // `compare` exits 1 when images differ; the AE count is on stderr.
    const metric = (e.stderr || '').trim();
    if (metric && !/unable|error|no decode/i.test(metric)) {
      console.log(`Δ diff: ${metric} pixels differ vs ${baseline}  →  ${diffOut}`);
    } else {
      console.error(`diff failed: ${metric || e.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
