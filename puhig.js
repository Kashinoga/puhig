// Module-pattern IIFE: keeps every declaration below off `window` so the page
// script leaks no globals. Body is intentionally left un-indented so this
// retrofit stays a 2-line diff rather than re-touching all ~1000 lines.
(function () {
function getPalette() {
  var s = getComputedStyle(document.documentElement);
  return [
    s.getPropertyValue("--mosaic-black").trim(),
    s.getPropertyValue("--teal").trim(),
    s.getPropertyValue("--orange").trim(),
    s.getPropertyValue("--mosaic-white").trim(),
    s.getPropertyValue("--yellow").trim(),
    s.getPropertyValue("--pink").trim(),
    s.getPropertyValue("--purple").trim(),
  ];
}

function getMosaicColors() {
  var s = getComputedStyle(document.documentElement);
  return {
    hover:  s.getPropertyValue("--mosaic-hover").trim(),
    press:  s.getPropertyValue("--mosaic-press").trim(),
    grid:   s.getPropertyValue("--mosaic-grid").trim(),
  };
}
var resizeTimer = null;
var lastResizeW = window.innerWidth;
var mosaicInitDone = false;
var mosaicEntryPlayed = false;
// Honour the OS "reduce motion" setting for auto-playing motion (the staggered
// tile entry and the perpetual drift loop). Checked live at each use site.
var reduceMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
var pressRegistry = [];
document.addEventListener("pointerup", function () {
  pressRegistry.forEach(function (fn) { fn(); });
});

function tileRand(c, r, salt, seed) {
  var n =
    (c * 1664525 +
      r * 1013904223 +
      (salt || 0) * 22695477 +
      seed * 1234567) &
    0xffffffff;
  n = (((n >>> 16) ^ n) * 0x45d9f3b) & 0xffffffff;
  return (n >>> 0) / 4294967296;
}

function valueNoise(c, r, period, salt, seed) {
  var gc = Math.floor(c / period);
  var gr = Math.floor(r / period);
  var fx = (c / period) - gc;
  var fy = (r / period) - gr;
  var ux = fx * fx * (3 - 2 * fx);
  var uy = fy * fy * (3 - 2 * fy);
  var v00 = tileRand(gc,     gr,     salt, seed);
  var v10 = tileRand(gc + 1, gr,     salt, seed);
  var v01 = tileRand(gc,     gr + 1, salt, seed);
  var v11 = tileRand(gc + 1, gr + 1, salt, seed);
  return v00 + (v10 - v00) * ux + (v01 - v00) * uy + (v00 + v11 - v10 - v01) * ux * uy;
}

function organicDrop(c, r, seed) {
  return valueNoise(c, r, 4, 10, seed) * 0.6
       + valueNoise(c, r, 2, 11, seed) * 0.3
       + valueNoise(c, r, 1, 12, seed) * 0.1;
}

function sampleN(arr, n) {
  var copy = arr.slice();
  for (var i = copy.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
  }
  return copy.slice(0, Math.min(n, copy.length));
}

function buildGrid(ns, svg, W, H, cols, rows, tw, th, gridStroke) {
  var g = document.createElementNS(ns, "g");
  g.setAttribute("stroke", gridStroke || "rgba(0,0,0,0.15)");
  g.setAttribute("stroke-width", "1");
  g.setAttribute("fill", "none");
  for (var c = 1; c < cols; c++) {
    var lx = (c * tw).toFixed(2);
    var ln = document.createElementNS(ns, "line");
    ln.setAttribute("x1", lx); ln.setAttribute("y1", "0");
    ln.setAttribute("x2", lx); ln.setAttribute("y2", H);
    g.appendChild(ln);
  }
  for (var r = 1; r < rows; r++) {
    var ly = (r * th).toFixed(2);
    var ln2 = document.createElementNS(ns, "line");
    ln2.setAttribute("x1", "0"); ln2.setAttribute("y1", ly);
    ln2.setAttribute("x2", W);  ln2.setAttribute("y2", ly);
    g.appendChild(ln2);
  }
  svg.appendChild(g);
}

// Creates hover, ripple, and press overlay rects on first interaction.
// Deferred from build time so initial SVG DOM is 4× smaller (tiles only).
function ensureOverlays(svg) {
  if (svg._ripples.length > 0) return;
  var mc = svg._mc;
  var ns = "http://www.w3.org/2000/svg";
  svg._tileData.forEach(function (td) {
    var ripple = document.createElementNS(ns, "rect");
    ripple.setAttribute("x", td.x); ripple.setAttribute("y", td.y);
    ripple.setAttribute("width", td.w); ripple.setAttribute("height", td.h);
    ripple.setAttribute("fill", mc.hover);
    ripple.setAttribute("class", "mosaic-ripple");
    ripple.style.opacity = "0";
    ripple._accOpacity = 0; ripple._col = td.col; ripple._row = td.row;
    svg._ripples.push(ripple); svg.appendChild(ripple);

    var press = document.createElementNS(ns, "rect");
    press.setAttribute("x", td.x); press.setAttribute("y", td.y);
    press.setAttribute("width", td.w); press.setAttribute("height", td.h);
    press.setAttribute("fill", mc.press);
    press.setAttribute("class", "mosaic-press");
    press.style.opacity = "0";
    press._col = td.col; press._row = td.row;
    svg._presses.push(press); svg.appendChild(press);
  });
}

function buildTileLayers(ns, svg, rows, cols, tw, th, seed, isAlive, shuffleSalt, palette, mc, playEntry) {
  var colorOrder = palette.map(function (_, i) { return i; });
  for (var i = colorOrder.length - 1; i > 0; i--) {
    var j = Math.floor(tileRand(i, 0, shuffleSalt, seed) * (i + 1));
    var tmp = colorOrder[i]; colorOrder[i] = colorOrder[j]; colorOrder[j] = tmp;
  }
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      if (!isAlive(c, r)) continue;
      var colorIdx = Math.floor(tileRand(c, r, 1, seed) * palette.length);
      var color = palette[colorIdx];
      var ox = Math.round(20 + tileRand(c, r, 5, seed) * 60);
      var oy = Math.round(20 + tileRand(c, r, 6, seed) * 60);
      var x = (c * tw).toFixed(2);
      var y = (r * th).toFixed(2);
      var w = tw.toFixed(2);
      var h = th.toFixed(2);
      var rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", x);
      rect.setAttribute("y", y);
      rect.setAttribute("width", w);
      rect.setAttribute("height", h);
      rect.setAttribute("fill", color);
      rect.setAttribute("class", "mosaic-tile");
      rect.setAttribute("data-col", c);
      rect.setAttribute("data-row", r);
      rect.style.transformOrigin = ox + "% " + oy + "%";
      if (playEntry) {
        var delay = colorOrder[colorIdx] * 220 + Math.floor(tileRand(c, r, 4, seed) * 80);
        rect.setAttribute("data-delay", delay);
        rect.style.setProperty("--delay", delay + "ms");
        // opacity:0 replaces animation-fill-mode backwards — hides tile during its
        // delay without holding a compositor layer in the pre-animation state.
        rect.style.opacity = "0";
      } else {
        rect.setAttribute("class", "mosaic-tile mosaic-tile--instant");
      }
      rect._col = c; rect._row = r;
      svg._tiles.push(rect);
      svg.appendChild(rect);
      svg._tileData.push({ col: c, row: r, x: x, y: y, w: w, h: h });
    }
  }
  svg._dormantSlots = [];
  for (var rd = 0; rd < rows; rd++) {
    for (var cd = 0; cd < cols; cd++) {
      if (isAlive(cd, rd)) continue;
      svg._dormantSlots.push({
        col: cd, row: rd,
        x: (cd * tw).toFixed(2), y: (rd * th).toFixed(2),
        w: tw.toFixed(2), h: th.toFixed(2)
      });
    }
  }
}

// Shared SVG shell for all three mosaic builders: the <svg> element, its grid
// lines, and the per-instance state buckets the press/ripple/drift code reads.
function createMosaicSVG(W, H, cols, rows, tw, th, gridStroke, mc) {
  var ns = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "mosaic-tiles-svg");
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  svg.setAttribute("aria-hidden", "true"); // decorative art — no info for AT
  svg.setAttribute("focusable", "false");
  buildGrid(ns, svg, W, H, cols, rows, tw, th, gridStroke);
  svg._tiles = []; svg._ripples = []; svg._presses = [];
  svg._tileData = []; svg._mc = mc || {};
  svg._maxDist = Math.sqrt(cols * cols + rows * rows);
  return svg;
}

function buildCAMosaicSVG(W, H, cols, rows, tw, th, seed, gridStroke, palette, mc, playEntry) {
  var r, c, dr, dc, nr, nc, alive, next;

  var grid = [];
  for (r = 0; r < rows; r++) {
    grid[r] = [];
    for (c = 0; c < cols; c++) {
      grid[r][c] = tileRand(c, r, 50, seed) < 0.90 ? 1 : 0;
    }
  }
  for (var iter = 0; iter < 4; iter++) {
    next = [];
    for (r = 0; r < rows; r++) {
      next[r] = [];
      for (c = 0; c < cols; c++) {
        alive = 0;
        for (dr = -1; dr <= 1; dr++) {
          for (dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            nr = r + dr; nc = c + dc;
            if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) alive++;
            else alive += grid[nr][nc];
          }
        }
        next[r][c] = (grid[r][c] === 1) ? (alive >= 4 ? 1 : 0) : (alive >= 5 ? 1 : 0);
      }
    }
    grid = next;
  }

  var ns = "http://www.w3.org/2000/svg";
  var svg = createMosaicSVG(W, H, cols, rows, tw, th, gridStroke, mc);
  buildTileLayers(ns, svg, rows, cols, tw, th, seed, function (c, r) { return !!grid[r][c]; }, 201, palette, mc, playEntry);
  return svg;
}

function buildMosaicSVG(W, H, cols, rows, tw, th, seed, gridStroke, palette, mc, playEntry) {
  var ns = "http://www.w3.org/2000/svg";
  var svg = createMosaicSVG(W, H, cols, rows, tw, th, gridStroke, mc);
  buildTileLayers(ns, svg, rows, cols, tw, th, seed, function () {
    return true;
  }, 200, palette, mc, playEntry);
  return svg;
}



function setupMosaicPress(container) {
  var pressActive = false;
  var pressTileCol = 0, pressTileRow = 0;
  var cleanupTimer = null;
  var PRESS_RADIUS = 4;
  var PRESS_SCALES  = [0.78, 0.85, 0.91, 0.96, 1.06];
  var PRESS_SHADOWS = [0.30, 0.18, 0.10, 0.04, 0.00];

  function startPress(cx, cy) {
    if (pressActive) return;
    pressActive = true;
    container.dataset.mosaicPressActive = "1";
    var svg = container._mosaicSvg;
    if (!svg) return;
    ensureOverlays(svg);
    var tw = container._tw || 24;
    var th = container._th || 24;
    pressTileCol = Math.floor(cx / tw);
    pressTileRow = Math.floor(cy / th);

    svg._tiles.forEach(function (tile) {
      var dist = Math.abs(tile._col - pressTileCol) + Math.abs(tile._row - pressTileRow);
      if (dist > PRESS_RADIUS) return;
      tile.style.transformOrigin = "50% 50%";
      tile.style.transition = "transform 70ms ease " + (dist * 10) + "ms";
      tile.style.transform = "scale(" + PRESS_SCALES[dist] + ")";
    });

    svg._presses.forEach(function (p) {
      var dist = Math.abs(p._col - pressTileCol) + Math.abs(p._row - pressTileRow);
      if (dist > PRESS_RADIUS) return;
      p.style.opacity = PRESS_SHADOWS[dist].toFixed(2);
    });
  }

  function endPress() {
    if (!pressActive) return;
    pressActive = false;
    container.dataset.mosaicPressActive = "0";
    var svg = container._mosaicSvg;
    if (!svg) return;
    svg._tiles.forEach(function (tile) {
      if (Math.abs(tile._col - pressTileCol) + Math.abs(tile._row - pressTileRow) > PRESS_RADIUS) return;
      tile.style.transition = "transform 360ms cubic-bezier(0.34, 1.56, 0.64, 1)";
      tile.style.transform = "scale(1)";
    });

    svg._presses.forEach(function (p) { p.style.opacity = "0"; });

    triggerRipple(svg);

    if (cleanupTimer) clearTimeout(cleanupTimer);
    var savedCol = pressTileCol, savedRow = pressTileRow;
    cleanupTimer = setTimeout(function () {
      cleanupTimer = null;
      svg._tiles.forEach(function (tile) {
        if (Math.abs(tile._col - savedCol) + Math.abs(tile._row - savedRow) > PRESS_RADIUS) return;
        tile.style.transform = "";
        tile.style.transition = "";
        tile.style.transformOrigin = "";
      });
    }, 500);
  }

  // RAF-based ripple: one requestAnimationFrame loop applies all pending opacity
  // changes each frame, replacing the prior O(N) setTimeout storm which forced
  // individual repaints on Safari for every callback.
  function triggerRipple(svg) {
    ensureOverlays(svg);
    var col = pressTileCol, row = pressTileRow;
    var maxDist = svg._maxDist;
    var t0 = performance.now();
    var events = [];

    svg._ripples.forEach(function (ripple) {
      var dc = ripple._col - col, dr = ripple._row - row;
      var dist = Math.sqrt(dc * dc + dr * dr);
      var delay = Math.round(dist * 35);
      var peak = Math.max(0, 1 - dist / maxDist) * 0.90;
      if (peak > 0) {
        events.push({ r: ripple, t: delay, d: peak });
        events.push({ r: ripple, t: delay + 80, d: -peak });
      }
    });

    if (!events.length) return;

    function tick(now) {
      var elapsed = now - t0;
      var i = events.length;
      while (i--) {
        if (elapsed >= events[i].t) {
          var ev = events.splice(i, 1)[0];
          ev.r._accOpacity = Math.min(1, Math.max(0, ev.r._accOpacity + ev.d));
          ev.r.style.opacity = ev.r._accOpacity.toFixed(3);
        }
      }
      if (events.length) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  container.addEventListener("pointerdown", function (e) {
    var bounds = container.getBoundingClientRect();
    startPress(e.clientX - bounds.left, e.clientY - bounds.top);
  });

  pressRegistry.push(endPress);
}

function startDriftLoop(svg, palette) {
  var ns = "http://www.w3.org/2000/svg";

  function driftTick() {
    if (!svg.isConnected) return;
    // Don't churn the DOM in a backgrounded tab; poll back and resume on return.
    if (document.hidden) { svg._driftTimer = setTimeout(driftTick, 1000); return; }
    var live = svg._tiles;
    var dormant = svg._dormantSlots;

    var removeCount = Math.min(1 + Math.floor(Math.random() * 4), live.length);
    var addCount = Math.min(1 + Math.floor(Math.random() * 4), dormant.length);

    var toRemove = sampleN(live, removeCount);
    toRemove.forEach(function (tile, i) {
      tile.style.animation = "tile-shrink 300ms ease-in " + (i * 80) + "ms both";
      tile.addEventListener("animationend", function onEnd() {
        tile.removeEventListener("animationend", onEnd);
        tile.remove();
        var idx = svg._tiles.indexOf(tile);
        if (idx >= 0) {
          svg._dormantSlots.push({
            col: tile._col, row: tile._row,
            x: tile.getAttribute("x"), y: tile.getAttribute("y"),
            w: tile.getAttribute("width"), h: tile.getAttribute("height")
          });
          svg._tiles.splice(idx, 1);
        }
      });
    });

    setTimeout(function () {
      if (!svg.isConnected) return;
      var toAdd = sampleN(svg._dormantSlots, addCount);
      toAdd.forEach(function (slot) {
        var idx = svg._dormantSlots.indexOf(slot);
        if (idx >= 0) svg._dormantSlots.splice(idx, 1);

        var colorIdx = Math.floor(Math.random() * palette.length);
        var ox = Math.round(20 + Math.random() * 60);
        var oy = Math.round(20 + Math.random() * 60);

        var rect = document.createElementNS(ns, "rect");
        rect.setAttribute("x", slot.x);
        rect.setAttribute("y", slot.y);
        rect.setAttribute("width", slot.w);
        rect.setAttribute("height", slot.h);
        rect.setAttribute("fill", palette[colorIdx]);
        rect.setAttribute("class", "mosaic-tile");
        rect.style.animation = "tile-grow 360ms ease-out both";
        rect.style.transformOrigin = ox + "% " + oy + "%";
        rect._col = slot.col; rect._row = slot.row;

        var firstOverlay = svg._ripples[0] || svg._presses[0];
        if (firstOverlay) {
          svg.insertBefore(rect, firstOverlay);
        } else {
          svg.appendChild(rect);
        }
        svg._tiles.push(rect);
      });

      var delay = 1800 + Math.floor(Math.random() * 1700);
      svg._driftTimer = setTimeout(driftTick, delay);
    }, 500);
  }

  svg._driftTimer = setTimeout(driftTick, 1500);
}

// Reads a 7-swatch themed palette (--miku-1..7, --light-1..7) off :root.
function getPrefixedPalette(prefix) {
  var s = getComputedStyle(document.documentElement);
  return [1, 2, 3, 4, 5, 6, 7].map(function (n) {
    return s.getPropertyValue("--" + prefix + "-" + n).trim();
  });
}

function buildGridSVG(W, H, cols, rows, tw, th, gridStroke, mc) {
  return createMosaicSVG(W, H, cols, rows, tw, th, gridStroke, mc);
}


function fitMosaics(animate) {
  // Entry animation plays only once, only for mosaics in the viewport at page load.
  var playAllEntry = animate && !mosaicEntryPlayed && !reduceMotionMQ.matches;
  if (playAllEntry) mosaicEntryPlayed = true;

  // Sidebar width: largest multiple of 24px where content col stays >= 2× wider.
  //   (containerW - mosaicW) / mosaicW >= 2  →  mosaicCols <= containerW / 72
  // Applied at all viewports so tw=24 is consistent between sidebar and divider.
  var mosaicW = null;
  var refEl = document.querySelector(".mosaic-divider");
  if (refEl) {
    refEl.style.width = "";
    var containerW = Math.round(refEl.getBoundingClientRect().width);
    var mosaicCols = Math.max(Math.floor(containerW / 72), 1);
    var firstSidebar = document.querySelector(".panel-mosaic[data-mobile-cols]");
    if (firstSidebar && containerW <= 480) {
      var mobileCap = parseInt(firstSidebar.dataset.mobileCols);
      if (mobileCap && mobileCap < mosaicCols) mosaicCols = mobileCap;
    }
    mosaicW = mosaicCols * 24;
  }

  var defaultPalette = getPalette();
  var mc = getMosaicColors();
  var gridStroke = mc.grid;

  var overlays = document.querySelectorAll(".mosaic-overlay");

  // Pass 1: style writes only — no layout reads — batches all mutations before any forced reflow.
  overlays.forEach(function (overlay) {
    var p = overlay.parentElement;
    var isSidebar = p.classList.contains("panel-mosaic");
    p.style.width = "";
    p.style.flex = "";
    // Clear any prior height snap so pass 2 reads the natural (clamp) art
    // height and re-snaps it for the current width.
    if (p.classList.contains("card-art")) p.style.height = "";
    if (mosaicW !== null && isSidebar) {
      p.style.flex = "none";
      p.style.width = mosaicW + "px";
    }
  });

  // Pass 2: layout reads + SVG builds — one layout flush covers all reads in this loop.
  overlays.forEach(function (overlay) {
    var p = overlay.parentElement;
    var target = parseInt(p.dataset.target) || 24;
    var isSidebar = p.classList.contains("panel-mosaic");
    var isDivider = p.classList.contains("mosaic-divider");

    var W, W_full;
    if (mosaicW !== null && isSidebar) {
      W = mosaicW;
    } else {
      W_full = p.clientWidth;
      W = p.dataset.mosaicAlign === "left"
        ? W_full
        : Math.floor(W_full / target) * target;
    }
    if (!W) W = target;

    var H = p.clientHeight;
    if (!H) return;

    var isCA = p.dataset.mosaicType === "ca";
    var isGridOnly = "mosaicGridOnly" in p.dataset;
    var isStaticBg = isGridOnly || "mosaicStatic" in p.dataset;
    var isCardArt = p.classList.contains("card-art");
    var isCover = p.classList.contains("card-cover-art");
    var palette = p.dataset.mosaicPalette === "miku" ? getPrefixedPalette("miku")
      : p.dataset.mosaicPalette === "light" ? getPrefixedPalette("light")
      : p.dataset.mosaicPalette === "gray" ? getPrefixedPalette("gray")
      : p.dataset.mosaicPalette === "mono" ? getPrefixedPalette("mono")
      : p.dataset.mosaicPalette === "teal" ? getPrefixedPalette("teal")
      : p.dataset.mosaicPalette === "purple" ? getPrefixedPalette("purple")
      : defaultPalette;

    // Dimensions first — the card-art height is snapped to whole tile rows
    // before the cache check so the snap survives a cache-hit early return.
    var isLeft = p.dataset.mosaicAlign === "left";
    var cols = (isLeft ? Math.round(W / target) : Math.floor(W / target)) || 1;
    var tw, th, rows, H_build;
    if (isLeft) {
      // Card-art mosaics: square tiles. Derive the edge from the width (so
      // cols*tw === W exactly), then reuse it on both axes so tiles are never
      // stretched. For card-art, snap the art height to a whole number of those
      // square rows — no partial bottom row, no art-background band, and
      // matching-width cards get matching art heights. The full-bleed grid
      // background keeps its natural (viewport) height.
      tw = th = W / cols;
      rows = Math.max(1, Math.round(H / tw));
      if (isCover) {
        // Full-bleed cover art: tiles fill the frame on BOTH axes. Width tiles
        // stay square-derived (cols*tw === W); row height is taken from the
        // frame so rows*th === H exactly — no bottom remainder, no overflow clip.
        th = H / rows;
        H_build = H;
      } else if (isCardArt) {
        H_build = rows * tw;
        p.style.height = H_build + "px";
      } else {
        H_build = H;
      }
    } else {
      H_build = H;
      rows = (isCA ? Math.floor(H_build / target) : Math.round(H_build / target)) || 1;
      tw = W / cols;
      th = H_build / rows;
    }
    p.dataset.mosaicTw = tw;
    p.dataset.mosaicTh = th;
    p._tw = tw;
    p._th = th;

    var dimsKey = W + "x" + H_build;
    if (!animate && p.dataset.mosaicDims === dimsKey) return;
    p.dataset.mosaicDims = dimsKey;

    if (!p.dataset.mosaicSeed) {
      p.dataset.mosaicSeed = Math.floor(Math.random() * 100000);
    }
    var seed = parseInt(p.dataset.mosaicSeed);

    var existing = p.querySelector(".mosaic-tiles-svg");
    var inViewport = p.getBoundingClientRect().top < window.innerHeight;
    // Static mosaics (card-art, grid-only backgrounds) appear instantly — no
    // staggered tile entry animation.
    var playEntry = playAllEntry && inViewport && !isStaticBg;
    var newSvg = isGridOnly
      ? buildGridSVG(W, H_build, cols, rows, tw, th, gridStroke, mc)
      : (p.dataset.mosaicType === "ca"
          ? buildCAMosaicSVG(W, H_build, cols, rows, tw, th, seed, gridStroke, palette, mc, playEntry)
          : buildMosaicSVG(W, H_build, cols, rows, tw, th, seed, gridStroke, palette, mc, playEntry));
    if (!isSidebar && W_full !== undefined && W_full > W && p.dataset.mosaicAlign !== "left") {
      newSvg.style.left = (W_full - W) + "px";
      newSvg.style.width = W + "px";
    }

    if (!isStaticBg) {
      if (!p._mosaicPressBound) { setupMosaicPress(p); p._mosaicPressBound = true; }
    }

    // Regen (theme/bg change) swaps the SVG instantly — no tile-shrink
    // transition. New tiles just appear, the same as a layout-only rebuild.
    if (p._shrinkTimer) { clearTimeout(p._shrinkTimer); p._shrinkTimer = null; }
    if (existing && existing._driftTimer) { clearTimeout(existing._driftTimer); existing._driftTimer = null; }
    if (existing) existing.remove();
    p.appendChild(newSvg);
    p._mosaicSvg = newSvg;
    if (!isStaticBg && !reduceMotionMQ.matches) startDriftLoop(newSvg, palette);
  });
}

// Whichever of load/fonts.ready fires first triggers the animated entrance build;
// the second triggers a quiet layout-only check (animate=false) so a font-swap
// reflow can correct mosaic dimensions without replaying the entrance animation.
window.addEventListener("load", function () {
  if (!mosaicInitDone) { mosaicInitDone = true; fitMosaics(true); }
  else fitMosaics(false);
});

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(function () {
    if (!mosaicInitDone) { mosaicInitDone = true; fitMosaics(true); }
    else fitMosaics(false);
  });
}

window.addEventListener("resize", function () {
  var w = window.innerWidth;
  // Height-only changes are the mobile URL-bar showing/hiding — skip them.
  if (w === lastResizeW) return;
  lastResizeW = w;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function () { fitMosaics(false); }, 100);
});

// Keep the full-bleed grid background as tall as the document. #mosaic-bg is an
// absolute inset:0 layer, so it grows with the page — but its tiled SVG is only
// re-cut when fitMosaics re-reads the new height. Content added after load (the
// WX app dealing in result cards, any runtime growth) makes the page taller than
// it was when the grid was first built, leaving bare space below on scroll. A
// ResizeObserver on the body covers every height source generically; it's
// debounced and guarded on the measured height so a burst of growth (or a
// transform-only flip, which never changes layout) rebuilds at most once.
if (window.ResizeObserver) {
  var bgFitTimer, lastDocH = 0;
  new ResizeObserver(function () {
    var h = document.body.scrollHeight;
    if (h === lastDocH) return;
    lastDocH = h;
    clearTimeout(bgFitTimer);
    bgFitTimer = setTimeout(function () { fitMosaics(false); }, 100);
  }).observe(document.body);
}

(function () {
  var STORAGE_KEY = 'puhig-theme';
  var UI_THEME_KEY = 'puhig-ui-theme';
  var BG_KEY = 'puhig-bg';
  var html = document.documentElement;
  var appearanceOpts = Array.from(document.querySelectorAll('.theme-option[data-group="appearance"]'));
  var uiThemeOpts = Array.from(document.querySelectorAll('.theme-option[data-group="ui-theme"]'));
  var bgOpts = Array.from(document.querySelectorAll('.theme-option[data-group="bg"]'));

  // Resolve a preference to the appearance that actually paints, so 'system'
  // collapses to the OS setting. Switching between two prefs that resolve to the
  // same appearance (e.g. dark -> system while the OS is dark) uses identical
  // mosaic colors, so there's nothing to rebuild or re-animate.
  function resolveAppearance(pref) {
    if (pref === 'light' || pref === 'dark') return pref;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  var lastAppearance = null;
  var currentPref = null;

  function applyTheme(pref, redraw) {
    currentPref = pref;
    if (pref === 'light' || pref === 'dark') {
      html.dataset.theme = pref;
    } else {
      delete html.dataset.theme;
    }
    appearanceOpts.forEach(function (o) {
      o.setAttribute('aria-pressed', String(o.dataset.value === pref));
    });
    var resolved = resolveAppearance(pref);
    var changed = resolved !== lastAppearance;
    lastAppearance = resolved;
    if (redraw && changed) fitMosaics(true);
  }

  function applyUITheme(pref) {
    delete html.dataset.uiTheme;
    uiThemeOpts.forEach(function (o) {
      o.setAttribute('aria-pressed', String(o.dataset.value === pref));
    });
  }

  function applyBG(pref, redraw) {
    var mosaicBg = document.getElementById('mosaic-bg');
    if (!mosaicBg) return;
    bgOpts.forEach(function (o) {
      o.setAttribute('aria-pressed', String(o.dataset.value === pref));
    });
    delete mosaicBg.dataset.mosaicType;
    delete mosaicBg.dataset.target;
    mosaicBg.dataset.mosaicGridOnly = '';
    if (redraw) {
      delete mosaicBg.dataset.mosaicDims;
      fitMosaics(true);
    }
  }

  var saved = localStorage.getItem(STORAGE_KEY) || 'system';
  applyTheme(saved, false);
  var savedUITheme = localStorage.getItem(UI_THEME_KEY) || 'simulacra';
  applyUITheme(savedUITheme);
  var savedBG = localStorage.getItem(BG_KEY) || 'grid';
  applyBG(savedBG, false);

  appearanceOpts.forEach(function (o) {
    o.addEventListener('click', function () {
      var val = o.dataset.value;
      val === 'system' ? localStorage.removeItem(STORAGE_KEY) : localStorage.setItem(STORAGE_KEY, val);
      applyTheme(val, true);
    });
  });

  uiThemeOpts.forEach(function (o) {
    o.addEventListener('click', function () {
      var val = o.dataset.value;
      val === 'simulacra' ? localStorage.removeItem(UI_THEME_KEY) : localStorage.setItem(UI_THEME_KEY, val);
      applyUITheme(val);
    });
  });

  bgOpts.forEach(function (o) {
    o.addEventListener('click', function () {
      var val = o.dataset.value;
      val === 'grid' ? localStorage.removeItem(BG_KEY) : localStorage.setItem(BG_KEY, val);
      applyBG(val, true);
    });
  });

  // An OS appearance flip only repaints the mosaics when 'system' is active and
  // the resolved appearance actually changes; applyTheme's guard no-ops an
  // explicit light/dark preference that ignores the OS.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    applyTheme(currentPref, true);
  });

}());

// Move el to last child of its .panel so it paints above all siblings
// regardless of compositor layer ordering (Safari backdrop-filter issue).
// WebKit returns "auto" from getComputedStyle for auto-placed grid items,
// so derive the explicit row/column from the element's visual offset instead.
// The element may live inside a display:contents wrapper (header/section), so
// save its true originalParent (not the panel) for correct DOM restoration.
function liftToFront(el) {
  var panel = el.closest('.panel');
  if (!panel) return null;
  var ps = window.getComputedStyle(panel);
  var gap = parseFloat(ps.gap) || parseFloat(ps.columnGap) || 12;
  var padL = parseFloat(ps.paddingLeft) || 0;
  var padT = parseFloat(ps.paddingTop) || 0;
  var col = Math.round((el.offsetLeft - padL) / (el.offsetWidth + gap)) + 1;
  var row = Math.round((el.offsetTop - padT) / (el.offsetHeight + gap)) + 1;
  var originalParent = el.parentNode;
  var originalNext = el.nextSibling;
  el.style.gridRow = row;
  el.style.gridColumn = col;
  panel.appendChild(el);
  return { panel: panel, originalParent: originalParent, originalNext: originalNext };
}

function restoreFromFront(el, lifted) {
  if (!lifted) return;
  el.style.gridRow = '';
  el.style.gridColumn = '';
  lifted.originalParent.insertBefore(el, lifted.originalNext);
}

// Builds Web Animations API keyframes for a flip that BEGINS at the card's
// current tilt pose (curTransform) instead of snapping to a flat 0% frame, so a
// hover-tilted card flips from exactly where it sits. Mirrors the CSS @keyframes
// profiles: a rotateX hump (8deg then 5deg, negated for top-edge flips) brackets
// the rotateY turn, which happens between 22% and 78%. Per-frame ease-in-out
// matches the CSS animation-timing-function (which eases each segment, unlike a
// single WAAPI options.easing). `flipped` is the state AFTER the toggle; prevBase
// is the card's resting yaw (deg) BEFORE this flip; curYaw is its live yaw
// (resting yaw + the hover tilt's rotateY) at the instant of the click.
//
// The lift frame (22%) holds rotateY at curYaw — NOT at a flat yStart. Snapping
// to yStart would unwind the hover tilt's yaw back to 0 before the turn begins,
// and at a corner that unwind runs opposite the flip, reading as a slight
// counter-rotation ("clockwise wobble") before the card reverses into the flip.
// Holding curYaw keeps rotateY monotonic from the tilt straight into the turn.
//
// `backStart` (the card was showing its back) selects the rotateX/rotateY order.
// The back tilt is written rotateY-then-rotateX (it's Y-mirrored), the front tilt
// rotateX-then-rotateY. Every frame in a flip MUST use the same order as its
// entry pose: WAAPI only interpolates rotations component-wise when the function
// lists match — a mismatch falls back to matrix decomposition, which injects a
// twist (the back-flip wobble). The hump sign is also negated for back flips so
// the lift continues the back tilt's (sign-flipped) rotateX instead of fighting it.
function buildFlipFrames(curTransform, flipped, flipSign, fromTop, prevBase, curYaw, backStart) {
  var xs = fromTop ? -1 : 1;            // top-edge flips hump the opposite way
  if (backStart) xs = -xs;             // back tilt negates rotateX; match it so the lift doesn't reverse
  var yStart = flipped ? 0 : prevBase;  // forward starts at front (0); back unwinds from its real yaw
  var yEnd = yStart + flipSign * 180;
  var P = 'perspective(600px) ';
  function pose(x, y) {
    return backStart
      ? P + 'rotateY(' + y + 'deg) rotateX(' + x + 'deg)'
      : P + 'rotateX(' + x + 'deg) rotateY(' + y + 'deg)';
  }
  return [
    { transform: curTransform, offset: 0, easing: 'ease-in-out' },
    { transform: pose(8 * xs, curYaw.toFixed(2)), offset: 0.22, easing: 'ease-in-out' },
    { transform: pose(5 * xs, yEnd), offset: 0.78, easing: 'ease-in-out' },
    { transform: pose(0, yEnd), offset: 1 }
  ];
}

// Pick-up grow for the flip: a 2D scale on the flat .panel-frame--flip/.card-sleeve
// (NOT the 3D inner), peaking over the flip's hump and settling back to rest. The
// frame scales the whole card (sleeve + faces) uniformly while staying flat, so it
// keeps compositing above neighbours by z-index — a scale on the 3D inner would
// clip under neighbours in Firefox, and would also spill the faces past the sleeve.
function buildGrowFrames() {
  var GROW = 1.07; // tunable pick-up scale
  return [
    { transform: 'scale(1)', offset: 0, easing: 'ease-in-out' },
    { transform: 'scale(' + GROW + ')', offset: 0.22, easing: 'ease-in-out' },
    { transform: 'scale(' + GROW + ')', offset: 0.78, easing: 'ease-in-out' },
    { transform: 'scale(1)', offset: 1 }
  ];
}

// Seal a flip element's 3D into a flat-composited layer: move its faces into an
// inner .flip-inner (preserve-3d) so the frame can stay flat and win z-index
// against neighbours. Idempotent; returns the inner element. See .flip-inner in
// puhig.css for why the split is required (Firefox 3D-context clipping).
function wrapFlipInner(el) {
  var existing = el.querySelector(':scope > .flip-inner');
  if (existing) return existing;
  var inner = document.createElement('div');
  inner.className = 'flip-inner';
  while (el.firstChild) inner.appendChild(el.firstChild);
  el.appendChild(inner);
  return inner;
}

// Press-and-hold tilt for touch devices. A pointer hovers to tilt a card in 3D,
// but touch has no hover: a quick tap flips (handled by the existing click path),
// while a sustained press engages the same tilt and finger-drag steers it.
// Releasing from a hold settles the card flat and suppresses the would-be flip.
// opts: { isBusy, tilt(clientX, clientY), reset(), onStart(), onEnd(suppressFlip) }.
function addPressHoldTilt(el, opts) {
  var HOLD_MS = 280;   // press duration before tilt mode engages (taps stay below it)
  var MOVE_TOL = 12;   // px of drift that turns an early press into a page scroll
  var timer = null, tilting = false, moved = false, sx = 0, sy = 0;

  el.addEventListener('touchstart', function (e) {
    if (opts.isBusy() || e.touches.length > 1) return;
    if (e.target.closest('button, a, input, select')) return;
    var t = e.touches[0];
    sx = t.clientX; sy = t.clientY; moved = false; tilting = false;
    opts.onStart();
    timer = setTimeout(function () {
      timer = null; tilting = true;
      opts.tilt(sx, sy); // engage from the resting press point
    }, HOLD_MS);
  }, { passive: true });

  el.addEventListener('touchmove', function (e) {
    var t = e.touches[0];
    if (!moved && (Math.abs(t.clientX - sx) > MOVE_TOL || Math.abs(t.clientY - sy) > MOVE_TOL)) moved = true;
    if (tilting) {
      e.preventDefault(); // own the gesture so the page doesn't scroll under the tilt
      opts.tilt(t.clientX, t.clientY);
    } else if (moved && timer) {
      clearTimeout(timer); timer = null; // moved before the hold engaged: let it scroll
    }
  }, { passive: false });

  function finish() {
    if (timer) { clearTimeout(timer); timer = null; }
    var didTilt = tilting; tilting = false;
    if (didTilt) opts.reset();
    // Any hold that engaged tilt settles flat and cancels the flip — a press long
    // enough to tilt reads as a deliberate hold, not a tap. (Browsers also drop the
    // synthetic click for a long press, so we can't rely on it to flip anyway.)
    opts.onEnd(didTilt);
  }
  el.addEventListener('touchend', finish);
  el.addEventListener('touchcancel', finish);
}

// One flip controller for both the settings panel (.panel-frame--flip) and the
// card sleeves (.card-sleeve): they share identical hover-tilt + press-hold +
// flip machinery and differ only via opts — (1) opts.lift: the settings panel
// lifts to the front of its grid mid-flip so it paints above neighbours, while
// sleeves must NOT (lifting collapses their 3-col grid row); (2) opts.exclude:
// the inner zones that suppress the flip click. See buildFlipFrames /
// wrapFlipInner for the 3D/flat split and the documented wobble fixes.
function initFlip(el, opts) {
  // The flat element holds z-index + the 2D grow; this inner layer holds the
  // 3D flip/tilt rotation, so all rotation transforms target `inner`.
  var inner = wrapFlipInner(el);
  var flipped = false;
  var animating = false;
  var lastFlipSign = -1; // -1 = right-edge flip (Y negative), +1 = left-edge flip (Y positive)
  var tiltX = 0, tiltY = 0;
  var targetX = 0, targetY = 0;
  var rafId = null;
  var recentTouch = false;   // ignore the synthetic mouse events a touch emits
  var clickSuppressed = false; // swallow the flip click that follows a hold-tilt
  var touchClear = null;

  function tiltFrame() {
    tiltX += (targetX - tiltX) * 0.15;
    tiltY += (targetY - tiltY) * 0.15;
    var base = lastFlipSign * 180;
    var transform = flipped
      ? 'perspective(600px) rotateY(' + (base + tiltY).toFixed(2) + 'deg) rotateX(' + tiltX.toFixed(2) + 'deg)'
      : 'perspective(600px) rotateX(' + tiltX.toFixed(2) + 'deg) rotateY(' + tiltY.toFixed(2) + 'deg)';
    if (Math.abs(tiltX - targetX) > 0.05 || Math.abs(tiltY - targetY) > 0.05) {
      inner.style.transform = transform;
      rafId = requestAnimationFrame(tiltFrame);
    } else {
      tiltX = targetX; tiltY = targetY; rafId = null;
      if (targetX === 0 && targetY === 0) {
        inner.style.transform = flipped ? 'perspective(600px) rotateY(' + base + 'deg)' : '';
      } else {
        inner.style.transform = transform;
      }
    }
  }

  function startTiltLoop() {
    if (animating) return;
    inner.style.transition = '';
    if (!rafId) rafId = requestAnimationFrame(tiltFrame);
  }

  function setTilt(clientX, clientY) {
    var rect = el.getBoundingClientRect();
    var rawX = ((clientY - (rect.top + rect.height / 2)) / (rect.height / 2)) * 6;
    var rawY = ((clientX - (rect.left + rect.width / 2)) / (rect.width / 2)) * 6;
    targetX = flipped ? -rawX : rawX;
    targetY = -rawY; // back face is Y-mirrored, so horizontal tilt keeps the same sign
    startTiltLoop();
  }

  function resetTilt() { targetX = 0; targetY = 0; startTiltLoop(); }

  el.addEventListener('mousemove', function (e) {
    if (animating || recentTouch) return;
    setTilt(e.clientX, e.clientY);
  });

  el.addEventListener('mouseleave', function () {
    if (animating || recentTouch) return;
    resetTilt();
  });

  addPressHoldTilt(el, {
    isBusy: function () { return animating; },
    tilt: setTilt,
    reset: resetTilt,
    onStart: function () { recentTouch = true; if (touchClear) { clearTimeout(touchClear); touchClear = null; } },
    onEnd: function (suppressFlip) {
      if (suppressFlip) clickSuppressed = true;
      touchClear = setTimeout(function () { recentTouch = false; clickSuppressed = false; }, 700);
    }
  });

  function flip(e) {
    if (animating) return;
    var rect = el.getBoundingClientRect();
    var flipSign = e.clientX < rect.left + rect.width / 2 ? 1 : -1;
    var fromTop = e.clientY < rect.top + rect.height / 2;

    // Snapshot the live tilt pose BEFORE mutating state, so the flip starts
    // exactly where the hover tilt left the card (no snap to a flat 0% frame).
    var prevBase = lastFlipSign * 180;
    var backStart = flipped;
    var curYaw = (flipped ? prevBase : 0) + tiltY;
    var curTransform = flipped
      ? 'perspective(600px) rotateY(' + (prevBase + tiltY).toFixed(2) + 'deg) rotateX(' + tiltX.toFixed(2) + 'deg)'
      : 'perspective(600px) rotateX(' + tiltX.toFixed(2) + 'deg) rotateY(' + tiltY.toFixed(2) + 'deg)';

    lastFlipSign = flipSign;
    flipped = !flipped;
    animating = true;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    tiltX = 0; tiltY = 0; targetX = 0; targetY = 0;
    inner.style.transition = '';
    el.style.zIndex = '100';

    var panel = null, lifted = null;
    if (opts.lift) {
      panel = el.closest('.panel');
      if (panel) panel.classList.add('panel--flipping');
      lifted = liftToFront(el);
    }

    // Rotation on the 3D inner; the 2D pick-up grow on the flat element. Both run
    // 650ms from the same tick so they stay in lockstep.
    var frames = buildFlipFrames(curTransform, flipped, flipSign, fromTop, prevBase, curYaw, backStart);
    var anim = inner.animate(frames, { duration: 650, fill: 'forwards' });
    var growAnim = el.animate(buildGrowFrames(), { duration: 650 });
    anim.onfinish = function () {
      if (opts.lift) {
        if (panel) panel.classList.remove('panel--flipping');
        restoreFromFront(el, lifted);
      }
      el.style.zIndex = '';
      el.style.transform = '';
      inner.style.transform = flipped ? 'perspective(600px) rotateY(' + (lastFlipSign * 180) + 'deg)' : '';
      anim.cancel();
      growAnim.cancel();
      animating = false;
    };
  }

  // Flip on click anywhere except the interactive controls and text zones
  // (opts.exclude). card-art is intentionally not excluded — no text there,
  // large flip target.
  el.addEventListener('click', function (e) {
    if (clickSuppressed) { clickSuppressed = false; return; }
    if (e.target.closest(opts.exclude)) return;
    flip(e);
  });
}

// Text/control zones that should not trigger a flip when clicked.
var FLIP_EXCLUDE = '.card-name, .card-cost, .card-subtitle, .card-type, .card-text-box, .card-footer';

// Init flip/tilt on a sleeve (or the settings panel). Idempotent via a
// data-flip-init guard so the observer below can re-offer a card harmlessly.
function initSleeve(el) {
  if (el.dataset.flipInit) return;
  el.dataset.flipInit = '1';
  if (el.classList.contains('panel-frame--flip')) {
    initFlip(el, { lift: true, exclude: 'button, a, input, select, ' + FLIP_EXCLUDE });
  } else {
    initFlip(el, { lift: false, exclude: FLIP_EXCLUDE });
  }
}

document.querySelectorAll('.panel-frame--flip, .card-sleeve').forEach(initSleeve);

// Runtime card support: cards added to the DOM after load (e.g. the WX app's
// weather results) get the same flip/tilt + cover-mosaic init as the authored
// deck, so a dynamically-built grid behaves identically to a static one. Keeps
// the no-globals contract — the framework watches its own subtree rather than
// exposing an init hook. Mosaic drift churn is skipped cheaply: those mutations
// target nodes inside .mosaic-overlay, so they never reach the card scan.
(function () {
  var observer = new MutationObserver(function (records) {
    var sawMosaic = false;
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      if (rec.target && rec.target.closest && rec.target.closest('.mosaic-overlay')) continue;
      for (var j = 0; j < rec.addedNodes.length; j++) {
        var node = rec.addedNodes[j];
        if (node.nodeType !== 1) continue;
        if (node.matches && node.matches('.panel-frame--flip, .card-sleeve')) initSleeve(node);
        if (node.querySelectorAll) {
          node.querySelectorAll('.panel-frame--flip, .card-sleeve').forEach(initSleeve);
          if ((node.matches && node.matches('.mosaic-overlay')) || node.querySelector('.mosaic-overlay')) sawMosaic = true;
        }
      }
    }
    if (sawMosaic) fitMosaics(false);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}());

// Hide purely-decorative chrome from assistive tech: the Phosphor icon glyphs,
// the cost pips, and the mosaic art layers carry no information the adjacent
// text doesn't already convey.
document.querySelectorAll('i[class*="ph"], .mosaic-overlay, #mosaic-bg, .card-pip')
  .forEach(function (el) { el.setAttribute('aria-hidden', 'true'); });

(function () {
  function setupScrollBtn(btn, action) {
    if (!btn) return;
    // action is optional: a nav-link control (e.g. the WX back button) carries
    // its own href, so it wants only the shared press bounce, not a JS handler.
    if (action) btn.addEventListener('click', action);
    btn.addEventListener('pointerdown', function (e) {
      btn.setPointerCapture(e.pointerId);
      btn.classList.remove('is-bouncing');
      btn.style.transition = 'transform 60ms ease';
      btn.style.transform = 'scale(0.88)';
    });
    btn.addEventListener('pointerup', function (e) {
      btn.releasePointerCapture(e.pointerId);
      btn.style.transition = '';
      btn.style.transform = '';
      btn.classList.add('is-bouncing');
    });
    btn.addEventListener('animationend', function () {
      btn.classList.remove('is-bouncing');
    });
  }

  setupScrollBtn(document.getElementById('scroll-top-btn'), function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  setupScrollBtn(document.getElementById('scroll-bottom-btn'), function () {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });
  // Back-to-deck control (WX and other sub-apps); navigation via its href.
  setupScrollBtn(document.getElementById('scroll-back-btn'));
}());

// App-to-app portal transition. The cover card is a named view-transition; the
// rest of the page is the `root` snapshot. We anchor root's scale origin on the
// cover so the whole outgoing app collapses into the portal and the incoming one
// is born from it (the CSS does the scaling; here we only place the origin).
// The exit origin is the cover's spot on the page we're LEAVING, so it rides
// across the navigation via sessionStorage; the enter origin is read live on the
// page we're arriving at.
(function () {
  function coverOrigin() {
    // The portal we're travelling through. With one app this is unambiguous;
    // future multi-app decks would match the cover by the navigated name.
    var cover = document.querySelector('[data-portal]');
    if (!cover) return null;
    var r = cover.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    var x = ((r.left + r.width / 2) / window.innerWidth) * 100;
    var y = ((r.top + r.height / 2) / window.innerHeight) * 100;
    return x.toFixed(2) + '% ' + y.toFixed(2) + '%';
  }
  window.addEventListener('pageswap', function (e) {
    if (!e.viewTransition) return;
    var o = coverOrigin();
    if (o) sessionStorage.setItem('vt-exit-origin', o);
    else sessionStorage.removeItem('vt-exit-origin');
  });
  window.addEventListener('pagereveal', function (e) {
    if (!e.viewTransition) return;
    var root = document.documentElement;
    var exit = sessionStorage.getItem('vt-exit-origin');
    var enter = coverOrigin();
    if (exit) root.style.setProperty('--vt-exit-origin', exit);
    if (enter) root.style.setProperty('--vt-enter-origin', enter);
  });
}());

// Cover-portal entry deal — the same cover-portal the WX deck plays, applied to
// every cover card on the page. A cover pops in (a quick scale-up carrying a touch
// of growth inertia), then its sibling cards are born tiny at the cover's centre
// and spat out to their slots while the cover's mosaic zooms — a vortex opening.
// The masthead cover (A 000) deals on page load; each section cover (A 100, A 200,
// …) deals when it first scrolls into view, so the spit-out plays where the reader
// can see it (matching how the mosaic tile entry is gated to the viewport). When we
// arrive through the cross-document cover portal (viaPortal), that morph IS the
// cover's entry, so we leave the cover alone and only spit its siblings — popping it
// would break the portal's morph target. FLIP-style: each card already sits in its
// final slot, so only transform + opacity animate (no reflow). fill:none reverts
// every part to rest on end. Skipped under reduced motion. Plays once per cover,
// after the initial fitMosaics build so the cover's mosaic exists for the zoom.
(function () {
  // Shared deal motion: a card is born tiny at the cover's centre (bornScale),
  // flies out on EASE, and lands a touch over-grown (growScale) before settling.
  var EASE = "cubic-bezier(0.2, 0.7, 0.25, 1)";
  var bornScale = 0.16; // size of a card at the vortex centre before it flies out
  var growScale = 1.05; // a card overshoots its rest size on landing, then settles

  // The portal pulse: the mosaic inside the cover zooms (zoomScale > 1) — the
  // vortex opening — holding between peakAt and closeAt then settling to rest. The
  // optional inhale (inhaleScale < 1 at inhaleAt) gives the zoom a breath: the
  // mosaic contracts first, then expands past rest to spit the cards out. fill:none
  // reverts it on end.
  function portalPulse(mosaic, total, peakAt, closeAt, zoomScale, inhaleScale, inhaleAt) {
    if (!mosaic) return;
    mosaic.style.transformOrigin = "center"; // zoom about the vortex centre
    var frames = [{ transform: "scale(1)", offset: 0, easing: "ease-in-out" }];
    if (inhaleScale != null) {
      frames.push({ transform: "scale(" + inhaleScale + ")", offset: inhaleAt, easing: "ease-in-out" });
    }
    frames.push({ transform: "scale(" + zoomScale + ")", offset: peakAt, easing: "ease-in-out" });
    frames.push({ transform: "scale(" + zoomScale + ")", offset: closeAt, easing: "ease-in-out" });
    frames.push({ transform: "scale(1)", offset: 1 });
    mosaic.animate(frames, { duration: total, easing: "linear" });
  }

  // Deal one cover's section in. `sleeve` is the cover's .card-sleeve; the masthead
  // is every other .panel-frame sharing its parent (the <header> or the <section>).
  function dealEntry(sleeve, viaPortal) {
    if (reduceMotionMQ.matches || !sleeve) return;
    var coverFrame = sleeve.querySelector(".card-frame--cover");
    var mosaic = coverFrame ? coverFrame.querySelector(".mosaic-tiles-svg") : null;
    var mast = Array.prototype.slice.call(sleeve.parentNode.children).filter(function (el) {
      return el.classList && el.classList.contains("panel-frame") && el !== sleeve;
    });
    // Nothing to spit and the cover is mid-morph — there's no entry to play.
    if (!mast.length && viaPortal) return;

    // Read every final rect first (one layout pass), then animate transforms.
    var base = sleeve.getBoundingClientRect();
    var rects = mast.map(function (c) { return c.getBoundingClientRect(); });

    var popDur = 360;     // the cover pops in (direct entry only)
    var emitDelay = 300;  // the first card emerges as the cover settles
    var emitStep = 90;    // gap between successive cards
    var emitDur = 460;    // one card's flight from the cover centre to its slot
    var settleDur = 160;  // the spit-out inertia
    var closeDur = 300;   // the mosaic eases back to rest behind the last card

    var lastIdx = mast.length - 1;
    var lastLand = emitDelay + lastIdx * emitStep + emitDur + settleDur;
    var closeStart = Math.max(emitDelay, lastLand - settleDur - 140);
    var total = Math.max(lastLand, closeStart + closeDur);

    // Direct entry: pop the cover in, then open the portal (mosaic zoom) as the
    // siblings spit. Via portal: the cover is mid-morph — touch neither.
    if (!viaPortal) {
      sleeve.animate(
        [
          { transform: "scale(0.84)", opacity: 0, easing: EASE },
          { transform: "scale(" + growScale + ")", opacity: 1, offset: 0.78, easing: "ease-out" },
          { transform: "none", opacity: 1 }
        ],
        { duration: popDur + 140 }
      );
      portalPulse(
        mosaic, total, emitDelay / total, closeStart / total, 1.28,
        0.88, 140 / total // breath in before the exhale spits the siblings out
      );
    }
    // Reveal the cover from the pre-deal hide: the running pop (or, via portal, the
    // morph) carries it in, so clearing the inline opacity now doesn't flash it.
    sleeve.style.opacity = "";

    mast.forEach(function (card, i) {
      var r = rects[i];
      // Same-row cards align top-left to the cover; the scale shrinks each to a
      // tile at the cover's centre before it flies out.
      var bornT = "translate(" + (base.left - r.left) + "px, " + (base.top - r.top) + "px) scale(" + bornScale + ")";
      var emitStart = emitDelay + i * emitStep;
      var emitEnd = emitStart + emitDur;
      var settleEnd = emitEnd + settleDur;

      var frames = [
        { transform: bornT, opacity: 0, offset: 0 },
        { transform: bornT, opacity: 0, offset: emitStart / total, easing: "ease-out" },
        { transform: bornT, opacity: 1, offset: (emitStart + 70) / total, easing: EASE },
        { transform: "scale(" + growScale + ")", opacity: 1, offset: emitEnd / total, easing: "ease-out" },
        { transform: "none", opacity: 1, offset: settleEnd / total }
      ];
      if (settleEnd < total) frames.push({ transform: "none", opacity: 1, offset: 1 });

      card.style.zIndex = String(100 - i);
      var anim = card.animate(frames, { duration: total, easing: "linear" });
      // The running deal holds the card hidden (opacity 0 at offset 0) then brings
      // it in, so clearing the pre-deal hide now reveals it without a flash.
      card.style.opacity = "";
      anim.onfinish = function () { card.style.zIndex = ""; };
    });
  }

  function sleeveOf(frame) { return frame.closest(".card-sleeve"); }

  // Pre-deal hide: a cover and its siblings start invisible (opacity only — slots
  // stay laid out, so rects read true) until their deal reveals them. Without this,
  // a section dealt on scroll-in would sit visible at rest, then snap to the born
  // pose and fly back — a jerk, since there's no exit animation. Applied only to the
  // viewport-triggered section covers; the masthead deals on load, near-immediately.
  function hideGroup(sleeve) {
    if (!sleeve) return;
    sleeve.style.opacity = "0";
    Array.prototype.slice.call(sleeve.parentNode.children).forEach(function (el) {
      if (el.classList && el.classList.contains("panel-frame") && el !== sleeve) el.style.opacity = "0";
    });
  }

  // The masthead cover (A 000) deals on load. pagereveal (where supported) fires
  // before paint and tells us whether the cover portal is morphing us in; we stash
  // that and run the deal on load, once the initial fitMosaics build has cut the
  // cover's mosaic so the zoom has tiles.
  var headerCover = document.querySelector("header .card-frame--cover");
  var headerSleeve = headerCover ? sleeveOf(headerCover) : null;
  var headerPlayed = false, viaPortal = false;
  function playHeader() {
    if (headerPlayed) return;
    headerPlayed = true;
    dealEntry(headerSleeve, viaPortal);
  }
  if ("onpagereveal" in window) {
    window.addEventListener("pagereveal", function (e) { viaPortal = !!e.viewTransition; });
  }
  window.addEventListener("load", function () { requestAnimationFrame(playHeader); });

  // Each section cover (A 100, A 200, …) deals once, the first time it scrolls into
  // view — so sections below the fold spit out as the reader reaches them rather
  // than animating unseen on load. (A section in view at load fires straight away.)
  var sectionSleeves = Array.prototype.slice
    .call(document.querySelectorAll("main section .card-frame--cover"))
    .map(sleeveOf)
    .filter(Boolean);
  // Hide them now (before first paint) so they don't show at rest then jerk into the
  // deal on scroll-in. Skipped under reduced motion (no deal runs to reveal them).
  if (!reduceMotionMQ.matches) sectionSleeves.forEach(hideGroup);
  window.addEventListener("load", function () {
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          dealEntry(en.target, false);
        });
      }, { threshold: 0.35 });
      sectionSleeves.forEach(function (s) { io.observe(s); });
    } else {
      // No IO: deal them all on load (still once each).
      requestAnimationFrame(function () {
        sectionSleeves.forEach(function (s) { dealEntry(s, false); });
      });
    }
  });
}());

if (navigator.maxTouchPoints > 0 && !window.matchMedia("(pointer: fine)").matches) {
  document.addEventListener("gesturestart", function (e) { e.preventDefault(); });
  document.addEventListener("touchmove", function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  var lastTouchEnd = 0;
  document.addEventListener("touchend", function (e) {
    var now = Date.now();
    if (now - lastTouchEnd < 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
}
}());
