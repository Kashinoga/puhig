#!/usr/bin/env node
// Catalogue contact sheet for Pocket Universe.
//
// Reviewing a row used to mean N separate screenshot.mjs runs. This clips every
// catalogue card in one pass and montages them into a single labelled grid per
// theme — so "did A600 survive the change?" is one image, not forty invocations.
// A reviewer scans the sheet; only the suspect cards need a full-res follow-up.
//
// Built on the same Playwright + theme-injection footing as screenshot.mjs (one
// page load per theme, clip each element's box) and the same ImageMagick suite
// screenshot.mjs already leans on for diffs — here `montage` instead of `compare`.
//
// Cards are found by selector and labelled by their .card-number ("A600"), so
// new rows appear automatically with no list to maintain.
//
// Usage:
//   node tools/contactsheet.mjs [options]
//   npm run sheet -- --theme dark
//
// Options:
//   --url <url>       Page to load            (default: file://<repo>/index.html)
//   --selector <css>  Card element to tile    (default: .card-sleeve)
//   --label <css>     Child holding the label (default: .card-number)
//   --theme <t>       light | dark | system   (default: light)
//   --both            Light AND dark, two sheets
//   --cols <n>        Tiles per row           (default: 4)
//   --width <px>      CSS viewport width      (default: 1280)
//   --dpr <n>         Device scale factor     (default: 2)
//   --out <path>      Sheet PNG               (default: tools/shots/sheet-<theme>.png)
//   --keep-tiles      Keep the per-card PNGs (default: removed after montage)
//   --wait <ms>       Settle delay for animations (default: 500)
//   --font <path>     TTF/TTC for tile captions (default: first system font found;
//                     none → sheet is built unlabelled)

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ImageMagick needs a real font FILE to caption tiles — this Homebrew build ships
// no default ("unable to read font"), and the project face is woff2 (unusable
// here). Resolve a system TTF/TTC, or fall back to an UNLABELLED sheet so the
// tool still works on Linux/CI. The project's own Jost can't caption these.
const FONT_CANDIDATES = [
  '/System/Library/Fonts/Helvetica.ttc',            // macOS
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', // Debian/Ubuntu
  '/usr/share/fonts/dejavu/DejaVuSans.ttf',          // Fedora/Arch
];
function resolveFont(override) {
  if (override) return existsSync(override) ? override : null;
  return FONT_CANDIDATES.find((f) => existsSync(f)) || null;
}

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

async function shootTheme(theme, o) {
  const tileDir = join(REPO, 'tools', 'shots', `_tiles-${theme}`);
  rmSync(tileDir, { recursive: true, force: true });
  mkdirSync(tileDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: o.width, height: 900 },
    deviceScaleFactor: o.dpr,
    colorScheme: theme === 'dark' ? 'dark' : 'light',
  });
  if (theme === 'light' || theme === 'dark') {
    // Appearance rides window.puhig.store's "hig" area (puhig/<VERSION>/hig/theme);
    // mirror the store VERSION here if it ever bumps.
    await context.addInitScript((t) => localStorage.setItem('puhig/1/hig/theme', t), theme);
  }
  const page = await context.newPage();
  await page.goto(o.url, { waitUntil: 'networkidle' });
  if (o.wait) await page.waitForTimeout(o.wait);

  const cards = page.locator(o.selector);
  const n = await cards.count();
  const labels = [];
  let shot = 0;
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i);
    if (!(await card.isVisible())) continue;
    const box = await card.boundingBox();
    if (!box || box.width < 8 || box.height < 8) continue;
    // label from the card's collector number, e.g. "A 600" → "A600"
    let label = `card-${i}`;
    const lab = card.locator(o.label).first();
    if (await lab.count()) {
      const t = (await lab.textContent() || '').replace(/\s+/g, '');
      if (t) label = t;
    }
    const idx = String(shot).padStart(2, '0'); // preserve document order in montage
    const file = join(tileDir, `${idx}-${label}.png`);
    await card.screenshot({ path: file });
    labels.push(label);
    shot++;
  }
  await browser.close();

  const out = o.out
    ? resolve(o.out)
    : join(REPO, 'tools', 'shots', `sheet-${theme}.png`);

  // montage tiles in filename order (the idx prefix preserves document order),
  // each captioned with its card number. -tile <cols>x lays out row by row.
  const tiles = readdirSync(tileDir).filter((f) => f.endsWith('.png')).sort()
    .map((f) => join(tileDir, f));
  const bg = theme === 'dark' ? '#141210' : '#edeef0';
  const fg = theme === 'dark' ? '#f5f5f0' : '#0a0a0a';
  const args = [
    '-tile', `${o.cols}x`,
    '-geometry', '+8+8',
    '-background', bg, '-fill', fg, '-pointsize', '18',
  ];
  if (o.font) args.push('-font', o.font, '-label', '%t'); // %t = idx-label basename
  execFileSync('montage', [...args, ...tiles, out], { stdio: ['ignore', 'pipe', 'pipe'] });

  if (!o.keepTiles) rmSync(tileDir, { recursive: true, force: true });
  console.log(`✓ ${out}  (${shot} cards, ${o.cols} cols, ${theme}${o.font ? '' : ', UNLABELLED — no system font found'})`);
  return out;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const o = {
    url: a.url || pathToFileURL(join(REPO, 'index.html')).href,
    selector: a.selector || '.card-sleeve',
    label: a.label || '.card-number',
    width: Number(a.width || 1280),
    dpr: Number(a.dpr || 2),
    cols: Number(a.cols || 4),
    out: a.out,
    keepTiles: !!a['keep-tiles'],
    wait: Number(a.wait ?? 500),
    font: resolveFont(a.font),
  };
  const themes = a.both ? ['light', 'dark'] : [a.theme || 'light'];
  for (const t of themes) await shootTheme(t, o);
}

main().catch((err) => { console.error(err); process.exit(1); });
