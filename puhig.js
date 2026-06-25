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
var LIGHT_RADIUS = 3;
var LIGHT_OPACITIES = (function () {
  var arr = [];
  for (var d = 0; d <= LIGHT_RADIUS; d++) {
    arr[d] = (Math.max(0, 1 - d / LIGHT_RADIUS) * 0.90).toFixed(3);
  }
  return arr;
}());
var resizeTimer = null;
var lastResizeW = window.innerWidth;
var valleyScrollSvg = null;
var valleyScrollRaf = null;

function applyValleyScroll() {
  valleyScrollRaf = null;
  if (!valleyScrollSvg || !valleyScrollSvg.isConnected) { valleyScrollSvg = null; return; }
  var maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  var scrollFraction = Math.min(1, window.scrollY / maxScroll);

  // Camera pan: shift the SVG upward to reveal deeper terrain as scroll increases.
  if (valleyScrollSvg._cameraInitialTop !== undefined) {
    var camTop = valleyScrollSvg._cameraInitialTop - scrollFraction * valleyScrollSvg._cameraMaxShift;
    valleyScrollSvg.style.top = camTop.toFixed(1) + 'px';
  }

  // Terrain dot colors are fixed at build time; only the fill-dot reveals animate.

  var fillDots = valleyScrollSvg._skyFillDots;
  for (var j = 0; j < fillDots.length; j++) {
    var fd = fillDots[j];
    fd.style.opacity = scrollFraction >= fd._skyRevealAt ? fd._skyOpacity : '0';
  }

  var purpleDots = valleyScrollSvg._purpleFillDots;
  for (var k = 0; k < purpleDots.length; k++) {
    var pd = purpleDots[k];
    if (scrollFraction >= pd._purpleRevealAt) {
      var localT = Math.min(1, (scrollFraction - pd._purpleRevealAt) / Math.max(0.01, 1 - pd._purpleRevealAt));
      pd.style.opacity = (parseFloat(pd._purpleOpacity) * localT).toFixed(3);
    } else {
      pd.style.opacity = '0';
    }
  }
}

function startValleyScroll(svg) {
  valleyScrollSvg = svg;
  applyValleyScroll();
}

window.addEventListener('scroll', function () {
  if (!valleyScrollSvg || valleyScrollRaf) return;
  valleyScrollRaf = requestAnimationFrame(applyValleyScroll);
}, { passive: true });
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
      var delay = colorOrder[colorIdx] * 220 + Math.floor(tileRand(c, r, 4, seed) * 80);
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

// Variant of setupMosaicLight for pointer-events:none containers (e.g. full-page
// background). Listens on document and maps client coords into the container's space.
// Pool-based variant for pointer-events:none containers (e.g. full-page background).
// Uses a fixed pool of (2*LIGHT_RADIUS+1)^2 rects that are repositioned each frame,
// avoiding the bulk DOM creation that ensureOverlays would trigger for large grids.
function setupMosaicLightGlobal(container) {
  var rafId = null;
  var pendingX = 0, pendingY = 0;
  var pool = null;
  var poolSvg = null;
  var ns = "http://www.w3.org/2000/svg";
  var DIAMETER = 2 * LIGHT_RADIUS + 1;

  function ensurePool(svg) {
    if (pool && poolSvg === svg) return;
    pool = null; poolSvg = svg;
    var color = (svg._mc && svg._mc.hover) || "#e8d060";
    pool = [];
    for (var i = 0; i < DIAMETER * DIAMETER; i++) {
      var rect = document.createElementNS(ns, "rect");
      rect.setAttribute("fill", color);
      rect.setAttribute("class", "mosaic-hover");
      rect.style.opacity = "0";
      rect._opacity = "0";
      rect._col = -1; rect._row = -1;
      pool.push(rect);
      svg.appendChild(rect);
    }
  }

  function applyLight(cx, cy) {
    var svg = container._mosaicSvg;
    if (!svg) return;
    ensurePool(svg);
    var tw = container._tw || 24;
    var th = container._th || 24;
    var W = parseFloat(svg.getAttribute("width"));
    var H = parseFloat(svg.getAttribute("height"));
    var maxCol = Math.floor(W / tw) - 1;
    var maxRow = Math.floor(H / th) - 1;
    var tileCol = Math.floor(cx / tw);
    var tileRow = Math.floor(cy / th);
    var i = 0;
    for (var dr = -LIGHT_RADIUS; dr <= LIGHT_RADIUS; dr++) {
      for (var dc = -LIGHT_RADIUS; dc <= LIGHT_RADIUS; dc++) {
        var rect = pool[i++];
        var nc = tileCol + dc;
        var nr = tileRow + dr;
        var dist = Math.abs(dc) + Math.abs(dr);
        if (dist > LIGHT_RADIUS || nc < 0 || nr < 0 || nc > maxCol || nr > maxRow) {
          if (rect._opacity !== "0") { rect._opacity = "0"; rect.style.opacity = "0"; }
          continue;
        }
        if (rect._col !== nc || rect._row !== nr) {
          rect.setAttribute("x", (nc * tw).toFixed(2));
          rect.setAttribute("y", (nr * th).toFixed(2));
          rect.setAttribute("width", tw.toFixed(2));
          rect.setAttribute("height", th.toFixed(2));
          rect._col = nc; rect._row = nr;
        }
        var target = LIGHT_OPACITIES[dist];
        if (rect._opacity !== target) { rect._opacity = target; rect.style.opacity = target; }
      }
    }
  }

  function clearLight() {
    if (!pool) return;
    pool.forEach(function (rect) {
      if (rect._opacity !== "0") { rect._opacity = "0"; rect.style.opacity = "0"; }
    });
  }

  document.addEventListener("mousemove", function (e) {
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

  document.addEventListener("mouseleave", function () {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    clearLight();
  });

  container._applyMosaicLight = function () {};
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

function buildGridSVG(W, H, cols, rows, tw, th, gridStroke, mc) {
  var ns = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "mosaic-tiles-svg");
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  buildGrid(ns, svg, W, H, cols, rows, tw, th, gridStroke);
  svg._tiles = []; svg._hovers = []; svg._ripples = []; svg._presses = [];
  svg._tileData = []; svg._mc = mc || {};
  return svg;
}

function buildDottedValleySVG(W, H, cols, rows, tw, th, seed, gridStroke, palette, mc, viewH) {
  var ns = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "mosaic-tiles-svg");
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  svg._tiles = []; svg._hovers = []; svg._ripples = []; svg._presses = [];
  svg._tileData = []; svg._mc = mc || {}; svg._dormantSlots = [];
  svg._skyFillDots = []; svg._purpleFillDots = [];

  var maxR = Math.min(tw, th) * 0.42;
  // Use base (non-theme-flipping) values — dark mode shifts teal/orange
  // toward muted variants that look wrong on a dark background.
  var skyColor = "#18cac0";
  var hillColors = ["#18cac0", "#e8d060", "#f06030", "#9878c0"];
  svg._hillColors = hillColors;
  var purpleColor = "#9878c0";

  // Bottom-layer group — purple fill dots render behind all other dots.
  var purpleGroup = document.createElementNS(ns, "g");
  svg.appendChild(purpleGroup);

  // Sky dots beyond the sparse initial threshold are pre-built but hidden;
  // they are revealed progressively as the user scrolls (sky fills up).
  var maxSkyP = 0.20;

  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var nx = cols > 1 ? c / (cols - 1) : 0.5;
      var ny = rows > 1 ? r / (rows - 1) : 0.5;

      // V-shape: horizon high at center (valley floor), rises toward edges
      // Small edge-drop (0.36) keeps wall bands narrow → farther-horizon look
      var distFromCenter = Math.abs(nx - 0.5) * 2;
      var horizon = 0.78 - 0.36 * distFromCenter
        + 0.04 * Math.sin(nx * Math.PI * 3.1 + 0.9);
      horizon = Math.max(0.10, Math.min(0.92, horizon));

      var noise1 = valueNoise(c, r, 4, 10, seed);
      var isSky = ny < horizon;
      var dotR, fillColor, opacity, delay;
      var isSkyFill = false;
      // bottom-up sweep: row 0 is top, row rows-1 is bottom
      var fromBottom = rows > 1 ? (rows - 1 - r) / (rows - 1) : 0;

      if (isSky) {
        var skyP = 0.04 + 0.06 * valueNoise(c, r, 12, 20, seed + 1);
        var skyRand = tileRand(c, r, 77, seed);
        if (skyRand >= maxSkyP) {
          var pdot = document.createElementNS(ns, "circle");
          var pdotR = maxR * (0.10 + 0.22 * noise1);
          pdot.setAttribute("cx", ((c + 0.5) * tw).toFixed(1));
          pdot.setAttribute("cy", ((r + 0.5) * th).toFixed(1));
          pdot.setAttribute("r", Math.max(0.5, pdotR).toFixed(1));
          pdot.setAttribute("fill", skyColor);
          pdot.style.opacity = "0";
          pdot._purpleRevealAt = 0.55 + 0.4 * tileRand(c, r, 91, seed);
          pdot._purpleOpacity = (0.18 + 0.12 * noise1).toFixed(3);
          purpleGroup.appendChild(pdot);
          svg._purpleFillDots.push(pdot);
          continue;
        }
        dotR = maxR * (0.08 + 0.20 * noise1);
        fillColor = skyColor;
        opacity = 0.18 + 0.12 * noise1;
        delay = Math.floor(tileRand(c, r, 3, seed) * 80 + fromBottom * 600);
        if (skyRand >= skyP) {
          isSkyFill = true;
        }
      } else {
        var depth = (ny - horizon) / Math.max(0.001, 1.0 - horizon);
        dotR = Math.min(maxR, maxR * Math.max(0.05, 0.05 + 0.85 * depth + 0.25 * noise1));
        opacity = Math.min(0.92, 0.35 + 0.55 * depth);
        var ridgeNoise = valueNoise(c, r, 6, 44, seed);
        var colorT = Math.max(0, Math.min(0.99, depth + 0.12 * (ridgeNoise - 0.5)));
        fillColor = hillColors[Math.floor(colorT * hillColors.length)];
        delay = Math.floor(tileRand(c, r, 5, seed) * 80 + fromBottom * 600);
      }

      var cx = (c + 0.5) * tw;
      var cy = (r + 0.5) * th;
      var dot = document.createElementNS(ns, "circle");
      if (!isSky) dot._colorT = colorT;
      dot.setAttribute("cx", cx.toFixed(1));
      dot.setAttribute("cy", cy.toFixed(1));
      dot.setAttribute("r", Math.max(0.5, dotR).toFixed(1));
      dot.setAttribute("fill", fillColor);
      dot.style.opacity = "0";
      dot._col = c; dot._row = r;

      if (isSkyFill) {
        dot._skyRevealAt = (skyRand - skyP) / (maxSkyP - skyP);
        dot._skyOpacity = opacity;
        svg._skyFillDots.push(dot);
      } else {
        dot.setAttribute("class", "mosaic-dot");
        dot.setAttribute("data-delay", delay);
        dot.style.setProperty("--delay", delay + "ms");
        svg._tiles.push(dot);
      }
      svg.appendChild(dot);
    }
  }

  // Camera pan: SVG is built taller than viewH; position so the horizon
  // appears at 88% of viewport height at scroll=0 (generous sky), then shift
  // up on scroll to reveal deeper terrain without changing dot colors.
  if (viewH && viewH < H) {
    var horizonFrac = 0.78;     // where horizon sits in the built SVG (ny ≈ 0.78)
    var initialViewFrac = 0.88; // horizon at 88% viewport height at scroll=0
    svg._cameraInitialTop = -(horizonFrac * H - initialViewFrac * viewH);
    svg._cameraMaxShift = (H - viewH) + svg._cameraInitialTop;
    svg.style.height = H + 'px';
    svg.style.top = svg._cameraInitialTop.toFixed(1) + 'px';
    svg.style.bottom = 'auto';
  }

  return svg;
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
      W = p.dataset.mosaicAlign === "left"
        ? W_full
        : Math.floor(W_full / target) * target;
    }
    if (!W) W = target;

    var H = p.offsetHeight;
    if (!H) return;

    var isCA = p.dataset.mosaicType === "ca";
    var isGridOnly = "mosaicGridOnly" in p.dataset;
    var isDottedValley = p.dataset.mosaicType === "dotted-valley";
    // Dotted valley: build SVG 2.5× taller than the viewport for the camera-pan effect.
    var H_build = isDottedValley ? Math.round(H * 2.5) : H;

    var dimsKey = W + "x" + H_build;
    if (!animate && p.dataset.mosaicDims === dimsKey) return;
    p.dataset.mosaicDims = dimsKey;

    if (!p.dataset.mosaicSeed) {
      p.dataset.mosaicSeed = Math.floor(Math.random() * 100000);
    }
    var seed = parseInt(p.dataset.mosaicSeed);

    var cols = (p.dataset.mosaicAlign === "left" ? Math.round(W / target) : Math.floor(W / target)) || 1;
    var rows = (isCA ? Math.floor(H_build / target) : Math.round(H_build / target)) || 1;
    var tw = W / cols;
    var th = H_build / rows;
    p.dataset.mosaicTw = tw;
    p.dataset.mosaicTh = th;
    p._tw = tw;
    p._th = th;

    var existing = p.querySelector(".mosaic-tiles-svg");
    var newSvg = isGridOnly
      ? buildGridSVG(W, H_build, cols, rows, tw, th, gridStroke, mc)
      : isDottedValley
          ? buildDottedValleySVG(W, H_build, cols, rows, tw, th, seed, gridStroke, palette, mc, H)
          : (p.dataset.mosaicType === "ca"
              ? buildCAMosaicSVG(W, H, cols, rows, tw, th, seed, gridStroke, palette, mc)
              : buildMosaicSVG(W, H, cols, rows, tw, th, seed, gridStroke, palette, mc));
    if (!isSidebar && W_full !== undefined && W_full > W && p.dataset.mosaicAlign !== "left") {
      newSvg.style.left = (W_full - W) + "px";
      newSvg.style.width = W + "px";
    }

    var isStaticBg = isGridOnly || isDottedValley;
    if (!isStaticBg) {
      if (!p._mosaicLightBound) { setupMosaicLight(p); p._mosaicLightBound = true; }
      if (!p._mosaicPressBound) { setupMosaicPress(p); p._mosaicPressBound = true; }
    } else {
      if (!p._mosaicLightBound) { setupMosaicLightGlobal(p); p._mosaicLightBound = true; }
    }

    if (animate && existing) {
      if (p._shrinkTimer) clearTimeout(p._shrinkTimer);
      if (existing._driftTimer) { clearTimeout(existing._driftTimer); existing._driftTimer = null; }
      (existing._tiles || []).forEach(function (rect) {
        var d = Math.round((parseInt(rect.getAttribute("data-delay")) || 0) / 3);
        rect.style.animation = "tile-shrink 150ms ease-in " + d + "ms both";
      });
      var capturedPalette = palette;
      var capturedDottedValley = isDottedValley;
      p._shrinkTimer = setTimeout(function () {
        p._shrinkTimer = null;
        Array.from(p.querySelectorAll(".mosaic-tiles-svg")).forEach(function (s) { s.remove(); });
        p.appendChild(newSvg);
        p._mosaicSvg = newSvg;
        if (capturedDottedValley) startValleyScroll(newSvg);
        else if (!isGridOnly) startDriftLoop(newSvg, capturedPalette);
      }, 200);
    } else {
      if (p._shrinkTimer) { clearTimeout(p._shrinkTimer); p._shrinkTimer = null; }
      if (existing && existing._driftTimer) { clearTimeout(existing._driftTimer); existing._driftTimer = null; }
      if (existing) existing.remove();
      p.appendChild(newSvg);
      p._mosaicSvg = newSvg;
      if (isDottedValley) startValleyScroll(newSvg);
      else if (!isGridOnly) startDriftLoop(newSvg, palette);
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
  // Height-only changes are the mobile URL-bar showing/hiding — skip them to
  // prevent the dotted-valley background from replaying its entry animation on scroll.
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
  var switcher = document.querySelector('.theme-switcher');
  if (!switcher) return;
  var toggle = switcher.querySelector('.theme-toggle');
  var flyout = switcher.querySelector('.theme-flyout');
  var appearanceOpts = Array.from(switcher.querySelectorAll('.theme-option[data-group="appearance"]'));
  var uiThemeOpts = Array.from(switcher.querySelectorAll('.theme-option[data-group="ui-theme"]'));
  var bgOpts = Array.from(switcher.querySelectorAll('.theme-option[data-group="bg"]'));

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
    if (pref === 'plastic') {
      html.dataset.uiTheme = 'plastic';
    } else {
      delete html.dataset.uiTheme;
    }
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
    if (pref === 'dotted-valley') {
      delete mosaicBg.dataset.mosaicGridOnly;
      mosaicBg.dataset.mosaicType = 'dotted-valley';
      mosaicBg.dataset.target = '12';
    } else {
      delete mosaicBg.dataset.mosaicType;
      delete mosaicBg.dataset.target;
      mosaicBg.dataset.mosaicGridOnly = '';
    }
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
  if (savedBG === 'bliss') savedBG = 'dotted-valley';
  applyBG(savedBG, false);

  function closeFlyout() {
    if (!flyout.classList.contains('is-open') || flyout.classList.contains('is-closing')) return;
    flyout.classList.add('is-closing');
    flyout.addEventListener('animationend', function () {
      flyout.classList.remove('is-open', 'is-closing');
    }, { once: true });
  }

  toggle.addEventListener('click', function (e) {
    e.stopPropagation();
    if (flyout.classList.contains('is-open')) {
      closeFlyout();
    } else {
      flyout.classList.remove('is-closing');
      flyout.classList.add('is-open');
    }
  });

  toggle.addEventListener('pointerdown', function (e) {
    toggle.setPointerCapture(e.pointerId);
    toggle.classList.remove('is-bouncing');
    toggle.style.transition = 'transform 60ms ease';
    toggle.style.transform = 'scale(0.88)';
  });

  toggle.addEventListener('pointerup', function (e) {
    toggle.releasePointerCapture(e.pointerId);
    toggle.style.transition = '';
    toggle.style.transform = '';
    toggle.classList.add('is-bouncing');
  });

  toggle.addEventListener('animationend', function () {
    toggle.classList.remove('is-bouncing');
  });

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

  document.addEventListener('click', function () {
    closeFlyout();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeFlyout();
  });

  flyout.addEventListener('click', function (e) { e.stopPropagation(); });

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
