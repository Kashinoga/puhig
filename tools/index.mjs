#!/usr/bin/env node
// Structural-index generator for Pocket Universe.
//
// Regenerates the derived tables in _INDEX.md so the "what exists and where"
// map can't drift from the source. It rewrites only the <!-- AUTO:key --> …
// <!-- /AUTO:key --> regions; all hand-written prose between them is left
// untouched. Everything is parsed statically (no browser, no deps).
//
// Usage:
//   node tools/index.mjs           Rewrite _INDEX.md in place
//   node tools/index.mjs --check   Exit 1 if _INDEX.md is stale (for CI)
//
// Derived regions: files · toolkits · wiring · blocks · catalogue · tools

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = join(REPO, "_INDEX.md");

const read = (rel) => readFileSync(join(REPO, rel), "utf8");
const lineAt = (src, idx) => src.slice(0, idx).split("\n").length;
const countLines = (rel) => read(rel).split("\n").length;

// ── Static source scanners ──────────────────────────────────────────────────

// Walk an object literal starting at the `{` at openIdx, string/comment aware.
// Returns { end, keys } where keys are the identifiers at brace-depth 1 that sit
// in member position (right after `{` or `,`) and are followed by `:`.
function scanObject(src, openIdx) {
  let depth = 0,
    inStr = null,
    line = false,
    block = false,
    lastSig = "",
    keys = [];
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i],
      n = src[i + 1];
    if (line) {
      if (c === "\n") line = false;
      continue;
    }
    if (block) {
      if (c === "*" && n === "/") {
        block = false;
        i++;
      }
      continue;
    }
    if (inStr) {
      if (c === "\\") i++;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === "/" && n === "/") {
      line = true;
      i++;
      continue;
    }
    if (c === "/" && n === "*") {
      block = true;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = c;
      lastSig = c;
      continue;
    }
    if (c === "{") {
      depth++;
      lastSig = "{";
      continue;
    }
    if (c === "}") {
      depth--;
      if (depth === 0) return { end: i, keys };
      lastSig = "}";
      continue;
    }
    if (depth === 1 && /[A-Za-z_$]/.test(c) && (lastSig === "{" || lastSig === ",")) {
      let j = i;
      while (j < src.length && /[\w$]/.test(src[j])) j++;
      const name = src.slice(i, j);
      let k = j;
      while (k < src.length && /\s/.test(src[k])) k++;
      if (src[k] === ":") keys.push(name);
      i = j - 1;
      lastSig = "id";
      continue;
    }
    if (!/\s/.test(c)) lastSig = c;
  }
  return { end: src.length, keys };
}

// Nearest `// ── … ──` banner text above a line index (drops the box chars and
// the trailing "(window.puhig.x)" so it reads as a plain purpose).
function bannerAbove(src, idx) {
  const before = src.slice(0, idx).split("\n");
  for (let i = before.length - 1; i >= 0; i--) {
    const m = before[i].match(/^\/\/\s*─+\s*(.+?)\s*─+\s*$/);
    if (m) return m[1].replace(/\s*\(window\.puhig\.[^)]*\)\s*/, "").trim();
  }
  return "";
}

// ── Region builders ─────────────────────────────────────────────────────────

const ROLES = [
  ["index.html", "HIG catalogue — the framework demo/spec deck"],
  ["puhig.css", "Framework styles (cards, mosaic, grid, themes, components)"],
  ["puhig.js", "Framework runtime: storage, mosaic, flip/sleeve, portal+deal, pagination"],
  ["phosphor.css", "Vendored Phosphor icon font CSS"],
  ["wx/index.html", "WX app markup — reference consumer"],
  ["wx/wx.css", "WX app styles"],
  ["wx/wx.js", "WX app logic — NWS data, response cache, portal deal-in"],
];

function filesRegion() {
  const rows = ROLES.map(([f, role]) => `| \`${f}\` | ${countLines(f)} | ${role} |`);
  return ["| File | Lines | Role |", "| --- | ---: | --- |", ...rows].join("\n");
}

function toolkitsRegion() {
  const src = read("puhig.js");
  const re = /window\.puhig\.([A-Za-z_$][\w$]*)\s*=\s*\(function/g;
  const rows = [];
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    const startLine = lineAt(src, m.index);
    const bodyOpen = src.indexOf("{", m.index);
    const { end } = scanObject(src, bodyOpen); // the IIFE body span
    const retIdx = src.lastIndexOf("return {", end);
    const keys = retIdx > m.index ? scanObject(src, src.indexOf("{", retIdx)).keys : [];
    const api = keys.map((k) => `\`${k}\``).join(", ") || "—";
    const purpose = bannerAbove(src, m.index) || "—";
    rows.push(`| \`${name}\` | \`puhig.js:${startLine}\` | ${api} | ${purpose} |`);
  }
  return ["| Toolkit | Defined | Public API | Purpose |", "| --- | ---: | --- | --- |", ...rows].join("\n");
}

// The line where a consumer first wires in each shared surface.
function wiringRegion() {
  const wx = read("wx/wx.js").split("\n");
  const find = (needle) => {
    const i = wx.findIndex((l) => l.includes(needle));
    return i < 0 ? "?" : i + 1;
  };
  const probes = [
    ['store.area("wx")', 'store.area("wx")'],
    ["window.puhig.portal", "window.puhig.portal"],
    ["paginate.paginate", "window.puhig.paginate.paginate"],
    ['store.area("portal"', 'store.area("portal", true)'],
  ];
  const parts = probes.map(([needle, label]) => `\`${label}\` (\`:${find(needle)}\`)`);
  return `Consumers wire in by name — e.g. \`wx/wx.js\`: ${parts.join(", ")}.`;
}

function blocksRegion() {
  const src = read("puhig.js").split("\n");
  const rows = [];
  src.forEach((l, i) => {
    const m = l.match(/^function\s+([A-Za-z_$][\w$]*)\s*\(/);
    if (m) rows.push(`| \`${m[1]}\` | ${i + 1} |`);
  });
  return ["| Function | Line |", "| --- | ---: |", ...rows].join("\n");
}

function catalogueRegion() {
  const html = read("index.html");
  const tokens = [...html.matchAll(/class="card-(name|number)">([^<]+)</g)];
  const rows = [];
  let name = "";
  for (const t of tokens) {
    if (t[1] === "name") name = t[2].replace(/&amp;/g, "&").trim();
    else rows.push(`| \`${t[2].trim()}\` | ${name || "—"} |`);
  }
  return ["| Card | Name |", "| --- | --- |", ...rows].join("\n");
}

function toolsRegion() {
  const scripts = JSON.parse(read("package.json")).scripts || {};
  const scriptFor = (file) =>
    Object.keys(scripts).find((k) => scripts[k].includes(`tools/${file}`));
  const rows = readdirSync(join(REPO, "tools"))
    .filter((f) => f.endsWith(".mjs"))
    .sort()
    .map((f) => {
      const desc =
        (read(`tools/${f}`).match(/^\/\/\s*(.+)$/m) || [, "—"])[1].replace(/ for Pocket Universe\.?$/, "");
      const s = scriptFor(f);
      return `| \`${f}\` | ${desc} | ${s ? `\`npm run ${s}\`` : "—"} |`;
    });
  return ["| Tool | Purpose | Script |", "| --- | --- | --- |", ...rows].join("\n");
}

const REGIONS = {
  files: filesRegion,
  toolkits: toolkitsRegion,
  wiring: wiringRegion,
  blocks: blocksRegion,
  catalogue: catalogueRegion,
  tools: toolsRegion,
};

// ── Scaffold (used when _INDEX.md is missing) ───────────────────────────────

function scaffold() {
  const auto = (k) => `<!-- AUTO:${k} -->\n\n<!-- /AUTO:${k} -->`;
  return `# Pocket Universe — Index

Internal, untracked (\`_\`-prefixed). A **structural map** — capability → where it lives — so
existing code gets reused and extended instead of re-invented (per \`CLAUDE.md\`).

- **This file** answers _"what exists and where."_ · \`_NOTES.md\` = _why_ · \`_TODO.md\` = _next_.

> Tables below are generated — run \`npm run index\`. Edit prose freely; it lives outside the
> \`<!-- AUTO:* -->\` markers and is never overwritten.

---

## Files at a glance

${auto("files")}

---

## Reusable framework toolkits — \`window.puhig.*\`

The reuse-first surface — check here before writing a new helper.

${auto("toolkits")}

${auto("wiring")}

---

## \`puhig.js\` internal building blocks

Top-level runtime functions (not yet on \`window.puhig\`):

${auto("blocks")}

---

## Apps / consumers

- **HIG** (\`index.html\`) — the catalogue is the spec; cards below.
- **WX** (\`wx/\`) — reference consumer: NWS data, response cache, portal deal-in.

${auto("catalogue")}

---

## Dev tooling — \`tools/*.mjs\` (headless)

${auto("tools")}
`;
}

// ── Apply ───────────────────────────────────────────────────────────────────

function render(doc) {
  let out = doc;
  for (const [key, build] of Object.entries(REGIONS)) {
    const re = new RegExp(`(<!-- AUTO:${key} -->)[\\s\\S]*?(<!-- /AUTO:${key} -->)`);
    if (!re.test(out)) {
      console.warn(`  (no <!-- AUTO:${key} --> region found; skipped)`);
      continue;
    }
    out = out.replace(re, `$1\n\n${build()}\n\n$2`);
  }
  return out;
}

const check = process.argv.includes("--check");
const current = existsSync(INDEX) ? readFileSync(INDEX, "utf8") : null;
const next = render(current ?? scaffold());

if (check) {
  if (current === next) {
    console.log("_INDEX.md is up to date.");
    process.exit(0);
  }
  console.error("_INDEX.md is stale — run `npm run index`.");
  process.exit(1);
}

writeFileSync(INDEX, next);
console.log(`_INDEX.md ${current ? "updated" : "created"} (${Object.keys(REGIONS).length} regions).`);
