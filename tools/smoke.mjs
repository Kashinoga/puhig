#!/usr/bin/env node
// Runtime smoke test for the WX app (and any framework consumer).
//
// wx.js fetches data and injects .card-sleeve cards at runtime; puhig.js's
// MutationObserver is what flip/tilt/mosaic-inits them (initSleeve stamps
// data-flip-init="1"). That wiring is invisible to the static tools — nothing
// catches it silently breaking except loading the page and watching it behave.
//
// This drives the deterministic CACHED path (no live NWS dependency), then
// asserts the runtime contract:
//   1. no console errors during load + deal
//   2. no uncaught exceptions / unhandled promise rejections
//   3. result cards were actually dealt (DOM grew)
//   4. EVERY .card-sleeve carries data-flip-init — i.e. the observer reached
//      every runtime-added card, not just the ones present at load
//
// Exit 1 if any check fails, so it can gate. Uses the cached fixture by default
// so it runs offline and repeatably.
//
// Usage:
//   node tools/smoke.mjs [options]
//   npm run smoke
//
// Options:
//   --url <url>      Consumer page         (default: file://<repo>/wx/index.html)
//   --trigger <css>  Click to populate     (default: #wx-cached)
//   --min-cards <n>  Fail if fewer .card-sleeve after the deal (default: 3)
//   --wait <ms>      Settle delay after load and after the deal (default: 1200)
//   --json           Emit results as JSON

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';

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

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const o = {
    url: a.url || pathToFileURL(join(REPO, 'wx', 'index.html')).href,
    trigger: a.trigger || '#wx-cached',
    minCards: Number(a['min-cards'] ?? 3),
    wait: Number(a.wait ?? 1200),
  };

  const consoleErrors = [];
  const pageErrors = [];

  const browser = await chromium.launch();
  const context = await browser.newContext();
  // capture unhandled promise rejections from inside the page
  await context.addInitScript(() => {
    window.__rejections = [];
    window.addEventListener('unhandledrejection', (e) =>
      window.__rejections.push(String(e.reason && e.reason.stack || e.reason)));
  });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.goto(o.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(o.wait);
  const cardsBefore = await page.locator('.card-sleeve').count();

  // deal the cached fixture
  const trigger = page.locator(o.trigger).first();
  const triggered = (await trigger.count()) > 0;
  if (triggered) await trigger.click();
  await page.waitForTimeout(o.wait);

  const cardsAfter = await page.locator('.card-sleeve').count();
  const rejections = await page.evaluate(() => window.__rejections || []);
  // sleeves the observer never initialised (missing data-flip-init)
  const uninit = await page.evaluate(() =>
    [...document.querySelectorAll('.card-sleeve')]
      .filter((el) => !el.dataset.flipInit)
      .map((el) => el.className));
  await browser.close();

  const checks = [
    { name: 'no console errors', pass: consoleErrors.length === 0, detail: consoleErrors },
    { name: 'no page errors / rejections', pass: pageErrors.length === 0 && rejections.length === 0, detail: [...pageErrors, ...rejections] },
    { name: `trigger ${o.trigger} present`, pass: triggered, detail: triggered ? [] : ['not found'] },
    { name: `result cards dealt (≥${o.minCards})`, pass: cardsAfter >= o.minCards, detail: [`${cardsBefore} → ${cardsAfter} .card-sleeve`] },
    { name: 'dealt cards grew the DOM', pass: cardsAfter > cardsBefore, detail: [`+${cardsAfter - cardsBefore}`] },
    { name: 'every .card-sleeve flip-initialised', pass: uninit.length === 0, detail: uninit },
  ];

  if (o.json) {
    console.log(JSON.stringify({ checks, cardsBefore, cardsAfter }, null, 2));
    if (checks.some((c) => !c.pass)) process.exitCode = 1;
    return;
  }

  const head = `WX smoke — ${o.url.split('/').slice(-2).join('/')}`;
  console.log(head + '\n' + '─'.repeat(head.length));
  for (const c of checks) {
    console.log(`${c.pass ? '✓' : '✗'} ${c.name}` + (c.detail.length ? `   ${c.detail.slice(0, 4).join(' · ')}` : ''));
  }
  const failed = checks.filter((c) => !c.pass).length;
  console.log(`\n${checks.length - failed}/${checks.length} passed.`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => { console.error(err); process.exit(1); });
