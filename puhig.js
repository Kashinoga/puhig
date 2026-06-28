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
  var svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "mosaic-tiles-svg");
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  buildGrid(ns, svg, W, H, cols, rows, tw, th, gridStroke);
  svg._tiles = []; svg._ripples = []; svg._presses = [];
  svg._tileData = []; svg._mc = mc;
  svg._maxDist = Math.sqrt(cols * cols + rows * rows);
  buildTileLayers(ns, svg, rows, cols, tw, th, seed, function (c, r) { return !!grid[r][c]; }, 201, palette, mc, playEntry);
  return svg;
}

function buildMosaicSVG(W, H, cols, rows, tw, th, seed, gridStroke, palette, mc, playEntry) {
  var ns = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "mosaic-tiles-svg");
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  buildGrid(ns, svg, W, H, cols, rows, tw, th, gridStroke);
  svg._tiles = []; svg._ripples = []; svg._presses = [];
  svg._tileData = []; svg._mc = mc;
  svg._maxDist = Math.sqrt(cols * cols + rows * rows);
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
    var live = svg._tiles;
    var dormant = svg._dormantSlots;

    var removeCount = Math.min(1 + Math.floor(Math.random() * 4), live.length);
    var addCount = Math.min(Math.max(1, 1 + Math.floor(Math.random() * 4)), dormant.length);

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

function getMikuPalette() {
  var s = getComputedStyle(document.documentElement);
  return [1, 2, 3, 4, 5, 6, 7].map(function (n) {
    return s.getPropertyValue("--miku-" + n).trim();
  });
}

function buildGridSVG(W, H, cols, rows, tw, th, gridStroke, mc) {
  var ns = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "mosaic-tiles-svg");
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  buildGrid(ns, svg, W, H, cols, rows, tw, th, gridStroke);
  svg._tiles = []; svg._ripples = []; svg._presses = [];
  svg._tileData = []; svg._mc = mc || {};
  return svg;
}


function fitMosaics(animate) {
  // Entry animation plays only once, only for mosaics in the viewport at page load.
  var playAllEntry = animate && !mosaicEntryPlayed;
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
    var palette = p.dataset.mosaicPalette === "miku" ? getMikuPalette() : defaultPalette;

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
      if (isCardArt) {
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

    if (animate && existing) {
      if (p._shrinkTimer) clearTimeout(p._shrinkTimer);
      if (existing._driftTimer) { clearTimeout(existing._driftTimer); existing._driftTimer = null; }
      (existing._tiles || []).forEach(function (rect) {
        var d = Math.round((parseInt(rect.getAttribute("data-delay")) || 0) / 3);
        rect.style.animation = "tile-shrink 150ms ease-in " + d + "ms both";
      });
      var capturedPalette = palette;
      p._shrinkTimer = setTimeout(function () {
        p._shrinkTimer = null;
        Array.from(p.querySelectorAll(".mosaic-tiles-svg")).forEach(function (s) { s.remove(); });
        p.appendChild(newSvg);
        p._mosaicSvg = newSvg;
        if (!isStaticBg) startDriftLoop(newSvg, capturedPalette);
      }, 200);
    } else {
      if (p._shrinkTimer) { clearTimeout(p._shrinkTimer); p._shrinkTimer = null; }
      if (existing && existing._driftTimer) { clearTimeout(existing._driftTimer); existing._driftTimer = null; }
      if (existing) existing.remove();
      p.appendChild(newSvg);
      p._mosaicSvg = newSvg;
      if (!isStaticBg) startDriftLoop(newSvg, palette);
    }
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

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
  fitMosaics(true);
});

(function () {
  var STORAGE_KEY = 'puhig-theme';
  var UI_THEME_KEY = 'puhig-ui-theme';
  var BG_KEY = 'puhig-bg';
  var html = document.documentElement;
  var appearanceOpts = Array.from(document.querySelectorAll('.theme-option[data-group="appearance"]'));
  var uiThemeOpts = Array.from(document.querySelectorAll('.theme-option[data-group="ui-theme"]'));
  var bgOpts = Array.from(document.querySelectorAll('.theme-option[data-group="bg"]'));

  function applyTheme(pref, redraw) {
    if (pref === 'light' || pref === 'dark') {
      html.dataset.theme = pref;
    } else {
      delete html.dataset.theme;
    }
    appearanceOpts.forEach(function (o) {
      o.setAttribute('aria-pressed', String(o.dataset.value === pref));
    });
    if (redraw) fitMosaics(true);
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

function initFlipCards() {
  document.querySelectorAll('.panel-frame--flip').forEach(function (card) {
    var flipped = false;
    var lastFlipSign = -1; // -1 = right-edge flip (Y negative), +1 = left-edge flip (Y positive)
    var lastFlipTop = false;
    var animating = false;
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
        card.style.transform = transform;
        rafId = requestAnimationFrame(tiltFrame);
      } else {
        tiltX = targetX; tiltY = targetY; rafId = null;
        if (targetX === 0 && targetY === 0) {
          card.style.transform = flipped ? 'perspective(600px) rotateY(' + base + 'deg)' : '';
        } else {
          card.style.transform = transform;
        }
      }
    }

    function startTiltLoop() {
      if (animating) return;
      card.style.transition = '';
      if (!rafId) rafId = requestAnimationFrame(tiltFrame);
    }

    function setTilt(clientX, clientY) {
      var rect = card.getBoundingClientRect();
      var rawX = ((clientY - (rect.top + rect.height / 2)) / (rect.height / 2)) * 6;
      var rawY = ((clientX - (rect.left + rect.width / 2)) / (rect.width / 2)) * 6;
      targetX = flipped ? -rawX : rawX;
      targetY = -rawY; // back face is Y-mirrored, so horizontal tilt keeps the same sign
      startTiltLoop();
    }

    function resetTilt() { targetX = 0; targetY = 0; startTiltLoop(); }

    card.addEventListener('mousemove', function (e) {
      if (animating || recentTouch) return;
      setTilt(e.clientX, e.clientY);
    });

    card.addEventListener('mouseleave', function () {
      if (animating || recentTouch) return;
      resetTilt();
    });

    addPressHoldTilt(card, {
      isBusy: function () { return animating; },
      tilt: setTilt,
      reset: resetTilt,
      onStart: function () { recentTouch = true; if (touchClear) { clearTimeout(touchClear); touchClear = null; } },
      onEnd: function (suppressFlip) {
        if (suppressFlip) clickSuppressed = true;
        touchClear = setTimeout(function () { recentTouch = false; clickSuppressed = false; }, 700);
      }
    });

    card.addEventListener('click', function (e) {
      if (clickSuppressed) { clickSuppressed = false; return; }
      if (animating) return;
      if (e.target.closest('button, a, input, select')) return;
      var rect = card.getBoundingClientRect();
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
      lastFlipTop = fromTop;
      flipped = !flipped;
      animating = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      tiltX = 0; tiltY = 0; targetX = 0; targetY = 0;
      card.style.transition = '';
      card.style.zIndex = '100';
      var panel = card.closest('.panel');
      if (panel) panel.classList.add('panel--flipping');
      var lifted = liftToFront(card);

      var frames = buildFlipFrames(curTransform, flipped, flipSign, fromTop, prevBase, curYaw, backStart);
      var anim = card.animate(frames, { duration: 650, fill: 'forwards' });
      anim.onfinish = function () {
        if (panel) panel.classList.remove('panel--flipping');
        restoreFromFront(card, lifted);
        card.style.zIndex = '';
        card.style.transform = flipped ? 'perspective(600px) rotateY(' + (lastFlipSign * 180) + 'deg)' : '';
        anim.cancel();
        animating = false;
      };
    });
  });
}

initFlipCards();

function initCardSleeveFlips() {
  document.querySelectorAll('.card-sleeve').forEach(function (sleeve) {
    var flipped = false;
    var animating = false;
    var lastFlipSign = -1; // -1 = right-edge flip (Y negative), +1 = left-edge flip (Y positive)
    var lastFlipTop = false;
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
        sleeve.style.transform = transform;
        rafId = requestAnimationFrame(tiltFrame);
      } else {
        tiltX = targetX; tiltY = targetY; rafId = null;
        if (targetX === 0 && targetY === 0) {
          sleeve.style.transform = flipped ? 'perspective(600px) rotateY(' + base + 'deg)' : '';
        } else {
          sleeve.style.transform = transform;
        }
      }
    }

    function startTiltLoop() {
      if (animating) return;
      sleeve.style.transition = '';
      if (!rafId) rafId = requestAnimationFrame(tiltFrame);
    }

    function setTilt(clientX, clientY) {
      var rect = sleeve.getBoundingClientRect();
      var rawX = ((clientY - (rect.top + rect.height / 2)) / (rect.height / 2)) * 6;
      var rawY = ((clientX - (rect.left + rect.width / 2)) / (rect.width / 2)) * 6;
      targetX = flipped ? -rawX : rawX;
      targetY = -rawY; // back face is Y-mirrored, so horizontal tilt keeps the same sign
      startTiltLoop();
    }

    function resetTilt() { targetX = 0; targetY = 0; startTiltLoop(); }

    sleeve.addEventListener('mousemove', function (e) {
      if (animating || recentTouch) return;
      setTilt(e.clientX, e.clientY);
    });

    sleeve.addEventListener('mouseleave', function () {
      if (animating || recentTouch) return;
      resetTilt();
    });

    addPressHoldTilt(sleeve, {
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
      var rect = sleeve.getBoundingClientRect();
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
      lastFlipTop = fromTop;
      flipped = !flipped;
      animating = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      tiltX = 0; tiltY = 0; targetX = 0; targetY = 0;
      sleeve.style.transition = '';
      sleeve.style.zIndex = '100';

      var frames = buildFlipFrames(curTransform, flipped, flipSign, fromTop, prevBase, curYaw, backStart);
      var anim = sleeve.animate(frames, { duration: 650, fill: 'forwards' });
      anim.onfinish = function () {
        sleeve.style.zIndex = '';
        sleeve.style.transform = flipped ? 'perspective(600px) rotateY(' + (lastFlipSign * 180) + 'deg)' : '';
        anim.cancel();
        animating = false;
      };
    }

    // Flip on click anywhere on the sleeve except text-content zones.
    // card-art is intentionally omitted — no text there, large flip target.
    sleeve.addEventListener('click', function (e) {
      if (clickSuppressed) { clickSuppressed = false; return; }
      if (e.target.closest('.card-name, .card-cost, .card-subtitle, .card-type, .card-text-box, .card-footer')) return;
      flip(e);
    });

    // Title icon: stop propagation so the sleeve handler above doesn't double-fire.
    var icon = sleeve.querySelector('.card-title-icon');
    if (icon) {
      icon.addEventListener('click', function (e) {
        e.stopPropagation();
        if (clickSuppressed) { clickSuppressed = false; return; }
        flip(e);
      });
    }
  });
}

initCardSleeveFlips();

(function () {
  function setupScrollBtn(btn, action) {
    if (!btn) return;
    btn.addEventListener('click', action);
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
