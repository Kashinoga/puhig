function getPalette() {
  var s = getComputedStyle(document.documentElement);
  return [
    s.getPropertyValue("--black").trim(),
    s.getPropertyValue("--teal").trim(),
    s.getPropertyValue("--orange").trim(),
    s.getPropertyValue("--white").trim(),
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
var LIGHT_RADIUS = 3;
var LIGHT_OPACITIES = (function () {
  var arr = [];
  for (var d = 0; d <= LIGHT_RADIUS; d++) {
    arr[d] = (Math.max(0, 1 - d / LIGHT_RADIUS) * 0.90).toFixed(3);
  }
  return arr;
}());
var shrinkTimer = null;
var resizeTimer = null;
var mosaicInitDone = false;
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
  if (svg._hovers.length > 0) return;
  var mc = svg._mc;
  var ns = "http://www.w3.org/2000/svg";
  svg._tileData.forEach(function (td) {
    var hover = document.createElementNS(ns, "rect");
    hover.setAttribute("x", td.x); hover.setAttribute("y", td.y);
    hover.setAttribute("width", td.w); hover.setAttribute("height", td.h);
    hover.setAttribute("fill", mc.hover);
    hover.setAttribute("class", "mosaic-hover");
    hover.style.opacity = "0";
    hover._opacity = "0"; hover._col = td.col; hover._row = td.row;
    svg._hovers.push(hover); svg.appendChild(hover);

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

function buildTileLayers(ns, svg, rows, cols, tw, th, seed, isAlive, shuffleSalt, palette, mc) {
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
      var delay = colorOrder[colorIdx] * 135 + Math.floor(tileRand(c, r, 4, seed) * 200);
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
      rect.setAttribute("data-delay", delay);
      rect.setAttribute("data-col", c);
      rect.setAttribute("data-row", r);
      rect.style.setProperty("--delay", delay + "ms");
      rect.style.transformOrigin = ox + "% " + oy + "%";
      // opacity:0 replaces animation-fill-mode backwards — hides tile during its
      // delay without holding a compositor layer in the pre-animation state.
      rect.style.opacity = "0";
      rect._col = c; rect._row = r;
      svg._tiles.push(rect);
      svg.appendChild(rect);
      svg._tileData.push({ col: c, row: r, x: x, y: y, w: w, h: h });
    }
  }
  svg._dormantSlots = [];
  for (var rd = 0; rd < rows; rd++) {
    for (var cd = 0; cd < cols; cd++) {
      var isEdgeDormant = cd === 0 || cd === cols - 1 || rd === 0 || rd === rows - 1;
      if (isEdgeDormant || isAlive(cd, rd)) continue;
      svg._dormantSlots.push({
        col: cd, row: rd,
        x: (cd * tw).toFixed(2), y: (rd * th).toFixed(2),
        w: tw.toFixed(2), h: th.toFixed(2)
      });
    }
  }
}

function buildCAMosaicSVG(W, H, cols, rows, tw, th, seed, gridStroke, palette, mc) {
  var r, c, dr, dc, nr, nc, alive, next;

  var grid = [];
  for (r = 0; r < rows; r++) {
    grid[r] = [];
    for (c = 0; c < cols; c++) {
      var isEdge = c === 0 || c === cols - 1 || r === 0 || r === rows - 1;
      grid[r][c] = isEdge ? 0 : (tileRand(c, r, 50, seed) < 0.45 ? 1 : 0);
    }
  }
  for (var iter = 0; iter < 4; iter++) {
    next = [];
    for (r = 0; r < rows; r++) {
      next[r] = [];
      for (c = 0; c < cols; c++) {
        var isEdge2 = c === 0 || c === cols - 1 || r === 0 || r === rows - 1;
        if (isEdge2) { next[r][c] = 0; continue; }
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
  svg._tiles = []; svg._hovers = []; svg._ripples = []; svg._presses = [];
  svg._tileData = []; svg._mc = mc;
  svg._maxDist = Math.sqrt(cols * cols + rows * rows);
  buildTileLayers(ns, svg, rows, cols, tw, th, seed, function (c, r) { return !!grid[r][c]; }, 201, palette, mc);
  return svg;
}

function buildMosaicSVG(W, H, cols, rows, tw, th, seed, gridStroke, palette, mc) {
  var ns = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "mosaic-tiles-svg");
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  buildGrid(ns, svg, W, H, cols, rows, tw, th, gridStroke);
  svg._tiles = []; svg._hovers = []; svg._ripples = []; svg._presses = [];
  svg._tileData = []; svg._mc = mc;
  svg._maxDist = Math.sqrt(cols * cols + rows * rows);
  buildTileLayers(ns, svg, rows, cols, tw, th, seed, function (c, r) {
    var isEdge = c === 0 || c === cols - 1 || r === 0 || r === rows - 1;
    var dropChance = isEdge ? 0.85 : organicDrop(c, r, seed) * 0.5;
    return tileRand(c, r, 0, seed) >= dropChance;
  }, 200, palette, mc);
  return svg;
}


function setupMosaicLight(container) {
  var rafId = null;
  var pendingX = 0, pendingY = 0;
  var cursorInside = false;

  function applyLight(cx, cy) {
    if (container.dataset.mosaicPressActive === "1") return;
    var svg = container._mosaicSvg;
    if (!svg) return;
    ensureOverlays(svg);
    var tw = container._tw || 24;
    var th = container._th || 24;
    var tileCol = Math.floor(cx / tw);
    var tileRow = Math.floor(cy / th);
    svg._hovers.forEach(function (glow) {
      var dist = Math.abs(glow._col - tileCol) + Math.abs(glow._row - tileRow);
      var target = dist <= LIGHT_RADIUS ? LIGHT_OPACITIES[dist] : "0";
      if (glow._opacity !== target) { glow._opacity = target; glow.style.opacity = target; }
    });
  }

  // Store raw client coords; getBoundingClientRect deferred into the RAF to
  // avoid forcing a layout flush on every mousemove when a frame is already queued.
  container.addEventListener("mousemove", function (e) {
    cursorInside = true;
    pendingX = e.clientX;
    pendingY = e.clientY;
    if (!rafId) {
      rafId = requestAnimationFrame(function () {
        rafId = null;
        var bounds = container.getBoundingClientRect();
        applyLight(pendingX - bounds.left, pendingY - bounds.top);
      });
    }
  });

  container.addEventListener("mouseleave", function () {
    cursorInside = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    var svg = container._mosaicSvg;
    if (!svg) return;
    svg._hovers.forEach(function (glow) { glow._opacity = "0"; glow.style.opacity = "0"; });
  });

  container._applyMosaicLight = function () {
    if (cursorInside) {
      var bounds = container.getBoundingClientRect();
      applyLight(pendingX - bounds.left, pendingY - bounds.top);
    }
  };
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

    svg._hovers.forEach(function (g) { g.style.opacity = "0"; });

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
    if (container._applyMosaicLight) container._applyMosaicLight();

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

        var firstOverlay = svg._hovers[0] || svg._ripples[0] || svg._presses[0];
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

function fitMosaics(animate) {
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

  var palette = getPalette();
  var mc = getMosaicColors();
  var gridStroke = mc.grid;

  var overlays = document.querySelectorAll(".mosaic-overlay");

  // Pass 1: style writes only — no layout reads — batches all mutations before any forced reflow.
  overlays.forEach(function (overlay) {
    var p = overlay.parentElement;
    var isSidebar = p.classList.contains("panel-mosaic");
    p.style.width = "";
    p.style.flex = "";
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
      W_full = p.offsetWidth;
      W = Math.floor(W_full / target) * target;
    }
    if (!W) W = target;

    var H = p.offsetHeight;
    if (!H) return;

    var dimsKey = W + "x" + H;
    if (!animate && p.dataset.mosaicDims === dimsKey) return;
    p.dataset.mosaicDims = dimsKey;

    if (!p.dataset.mosaicSeed) {
      p.dataset.mosaicSeed = Math.floor(Math.random() * 100000);
    }
    var seed = parseInt(p.dataset.mosaicSeed);

    var isCA = p.dataset.mosaicType === "ca";
    var cols = Math.floor(W / target) || 1;
    var rows = (isCA ? Math.floor(H / target) : Math.round(H / target)) || 1;
    var tw = W / cols;
    var th = H / rows;
    p.dataset.mosaicTw = tw;
    p.dataset.mosaicTh = th;
    p._tw = tw;
    p._th = th;

    var existing = p.querySelector(".mosaic-tiles-svg");
    var newSvg = p.dataset.mosaicType === "ca"
      ? buildCAMosaicSVG(W, H, cols, rows, tw, th, seed, gridStroke, palette, mc)
      : buildMosaicSVG(W, H, cols, rows, tw, th, seed, gridStroke, palette, mc);
    if (!isSidebar && W_full !== undefined && W_full > W) {
      newSvg.style.left = (W_full - W) + "px";
      newSvg.style.width = W + "px";
    }


    if (!p._mosaicLightBound) {
      setupMosaicLight(p);
      p._mosaicLightBound = true;
    }

    if (!p._mosaicPressBound) {
      setupMosaicPress(p);
      p._mosaicPressBound = true;
    }

    if (animate && existing) {
      if (shrinkTimer) clearTimeout(shrinkTimer);
      if (existing._driftTimer) { clearTimeout(existing._driftTimer); existing._driftTimer = null; }
      (existing._tiles || []).forEach(function (rect) {
        var d = Math.round((parseInt(rect.getAttribute("data-delay")) || 0) / 3);
        rect.style.animation = "tile-shrink 150ms ease-in " + d + "ms both";
      });
      var capturedPalette = palette;
      shrinkTimer = setTimeout(function () {
        shrinkTimer = null;
        Array.from(p.querySelectorAll(".mosaic-tiles-svg")).forEach(function (s) { s.remove(); });
        p.appendChild(newSvg);
        p._mosaicSvg = newSvg;
        startDriftLoop(newSvg, capturedPalette);
      }, 200);
    } else {
      if (shrinkTimer) { clearTimeout(shrinkTimer); shrinkTimer = null; }
      if (existing && existing._driftTimer) { clearTimeout(existing._driftTimer); existing._driftTimer = null; }
      if (existing) existing.remove();
      p.appendChild(newSvg);
      p._mosaicSvg = newSvg;
      startDriftLoop(newSvg, palette);
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
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function () { fitMosaics(false); }, 100);
});

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
  fitMosaics(true);
});

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
