var PALETTE = ["#0a0a0a", "#a8d8cc", "#e85d1a", "#f5f5f0"];
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

function buildGrid(ns, svg, W, H, cols, rows, tw, th) {
  var g = document.createElementNS(ns, "g");
  g.setAttribute("stroke", "rgba(0,0,0,0.15)");
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


function buildCAMosaicSVG(W, H, cols, rows, tw, th, seed) {
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
  buildGrid(ns, svg, W, H, cols, rows, tw, th);
  svg._tiles = []; svg._hovers = []; svg._ripples = []; svg._presses = [];
  svg._maxDist = Math.sqrt(cols * cols + rows * rows);

  var colorOrder = PALETTE.map(function (_, i) { return i; });
  for (var i = colorOrder.length - 1; i > 0; i--) {
    var j = Math.floor(tileRand(i, 0, 201, seed) * (i + 1));
    var tmp = colorOrder[i]; colorOrder[i] = colorOrder[j]; colorOrder[j] = tmp;
  }

  for (r = 0; r < rows; r++) {
    for (c = 0; c < cols; c++) {
      if (!grid[r][c]) continue;
      var colorIdx = Math.floor(tileRand(c, r, 1, seed) * PALETTE.length);
      var color = PALETTE[colorIdx];
      var delay = colorOrder[colorIdx] * 135 + Math.floor(tileRand(c, r, 4, seed) * 200);
      var ox = Math.round(20 + tileRand(c, r, 5, seed) * 60);
      var oy = Math.round(20 + tileRand(c, r, 6, seed) * 60);
      var rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", (c * tw).toFixed(2));
      rect.setAttribute("y", (r * th).toFixed(2));
      rect.setAttribute("width", tw.toFixed(2));
      rect.setAttribute("height", th.toFixed(2));
      rect.setAttribute("fill", color);
      rect.setAttribute("class", "mosaic-tile");
      rect.setAttribute("data-delay", delay);
      rect.setAttribute("data-col", c);
      rect.setAttribute("data-row", r);
      rect.style.setProperty("--delay", delay + "ms");
      rect.style.transformOrigin = ox + "% " + oy + "%";
      rect._col = c; rect._row = r; svg._tiles.push(rect);
      svg.appendChild(rect);
      var hover = document.createElementNS(ns, "rect");
      hover.setAttribute("x", (c * tw).toFixed(2));
      hover.setAttribute("y", (r * th).toFixed(2));
      hover.setAttribute("width", tw.toFixed(2));
      hover.setAttribute("height", th.toFixed(2));
      hover.setAttribute("fill", "#ffd8a8");
      hover.setAttribute("class", "mosaic-hover");
      hover.setAttribute("data-col", c);
      hover.setAttribute("data-row", r);
      hover.style.opacity = "0";
      hover._col = c; hover._row = r; svg._hovers.push(hover);
      svg.appendChild(hover);
      var ripple = document.createElementNS(ns, "rect");
      ripple.setAttribute("x", (c * tw).toFixed(2));
      ripple.setAttribute("y", (r * th).toFixed(2));
      ripple.setAttribute("width", tw.toFixed(2));
      ripple.setAttribute("height", th.toFixed(2));
      ripple.setAttribute("fill", "#ffd8a8");
      ripple.setAttribute("class", "mosaic-ripple");
      ripple.setAttribute("data-col", c);
      ripple.setAttribute("data-row", r);
      ripple.style.opacity = "0";
      ripple._col = c; ripple._row = r; svg._ripples.push(ripple);
      svg.appendChild(ripple);
      var press = document.createElementNS(ns, "rect");
      press.setAttribute("x", (c * tw).toFixed(2));
      press.setAttribute("y", (r * th).toFixed(2));
      press.setAttribute("width", tw.toFixed(2));
      press.setAttribute("height", th.toFixed(2));
      press.setAttribute("fill", "#0a0a0a");
      press.setAttribute("class", "mosaic-press");
      press.setAttribute("data-col", c);
      press.setAttribute("data-row", r);
      press.style.opacity = "0";
      press._col = c; press._row = r; svg._presses.push(press);
      svg.appendChild(press);
    }
  }

  return svg;
}

function buildMosaicSVG(W, H, cols, rows, tw, th, seed) {
  var ns = "http://www.w3.org/2000/svg";
  var svg = document.createElementNS(ns, "svg");
  svg.setAttribute("class", "mosaic-tiles-svg");
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  buildGrid(ns, svg, W, H, cols, rows, tw, th);
  svg._tiles = []; svg._hovers = []; svg._ripples = []; svg._presses = [];
  svg._maxDist = Math.sqrt(cols * cols + rows * rows);

  var colorOrder = PALETTE.map(function (_, i) { return i; });
  for (var i = colorOrder.length - 1; i > 0; i--) {
    var j = Math.floor(tileRand(i, 0, 200, seed) * (i + 1));
    var tmp = colorOrder[i]; colorOrder[i] = colorOrder[j]; colorOrder[j] = tmp;
  }

  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      var isEdge = c === 0 || c === cols - 1 || r === 0 || r === rows - 1;
      var dropChance = isEdge ? 0.85 : organicDrop(c, r, seed) * 0.5;
      if (tileRand(c, r, 0, seed) < dropChance) continue;

      var colorIdx = Math.floor(tileRand(c, r, 1, seed) * PALETTE.length);
      var color = PALETTE[colorIdx];
      var delay = colorOrder[colorIdx] * 135 + Math.floor(tileRand(c, r, 4, seed) * 200);
      var ox = Math.round(20 + tileRand(c, r, 5, seed) * 60);
      var oy = Math.round(20 + tileRand(c, r, 6, seed) * 60);

      var rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", (c * tw).toFixed(2));
      rect.setAttribute("y", (r * th).toFixed(2));
      rect.setAttribute("width", tw.toFixed(2));
      rect.setAttribute("height", th.toFixed(2));
      rect.setAttribute("fill", color);
      rect.setAttribute("class", "mosaic-tile");
      rect.setAttribute("data-delay", delay);
      rect.setAttribute("data-col", c);
      rect.setAttribute("data-row", r);
      rect.style.setProperty("--delay", delay + "ms");
      rect.style.transformOrigin = ox + "% " + oy + "%";
      rect._col = c; rect._row = r; svg._tiles.push(rect);
      svg.appendChild(rect);
      var hover = document.createElementNS(ns, "rect");
      hover.setAttribute("x", (c * tw).toFixed(2));
      hover.setAttribute("y", (r * th).toFixed(2));
      hover.setAttribute("width", tw.toFixed(2));
      hover.setAttribute("height", th.toFixed(2));
      hover.setAttribute("fill", "#ffd8a8");
      hover.setAttribute("class", "mosaic-hover");
      hover.setAttribute("data-col", c);
      hover.setAttribute("data-row", r);
      hover.style.opacity = "0";
      hover._col = c; hover._row = r; svg._hovers.push(hover);
      svg.appendChild(hover);
      var ripple = document.createElementNS(ns, "rect");
      ripple.setAttribute("x", (c * tw).toFixed(2));
      ripple.setAttribute("y", (r * th).toFixed(2));
      ripple.setAttribute("width", tw.toFixed(2));
      ripple.setAttribute("height", th.toFixed(2));
      ripple.setAttribute("fill", "#ffd8a8");
      ripple.setAttribute("class", "mosaic-ripple");
      ripple.setAttribute("data-col", c);
      ripple.setAttribute("data-row", r);
      ripple.style.opacity = "0";
      ripple._col = c; ripple._row = r; svg._ripples.push(ripple);
      svg.appendChild(ripple);
      var press = document.createElementNS(ns, "rect");
      press.setAttribute("x", (c * tw).toFixed(2));
      press.setAttribute("y", (r * th).toFixed(2));
      press.setAttribute("width", tw.toFixed(2));
      press.setAttribute("height", th.toFixed(2));
      press.setAttribute("fill", "#0a0a0a");
      press.setAttribute("class", "mosaic-press");
      press.setAttribute("data-col", c);
      press.setAttribute("data-row", r);
      press.style.opacity = "0";
      press._col = c; press._row = r; svg._presses.push(press);
      svg.appendChild(press);
    }
  }

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
    var tw = container._tw || 24;
    var th = container._th || 24;
    var tileCol = Math.floor(cx / tw);
    var tileRow = Math.floor(cy / th);
    svg._hovers.forEach(function (glow) {
      var dist = Math.abs(glow._col - tileCol) + Math.abs(glow._row - tileRow);
      glow.style.opacity = dist <= LIGHT_RADIUS ? LIGHT_OPACITIES[dist] : "0";
    });
  }

  container.addEventListener("mousemove", function (e) {
    cursorInside = true;
    var bounds = container.getBoundingClientRect();
    pendingX = e.clientX - bounds.left;
    pendingY = e.clientY - bounds.top;
    if (!rafId) {
      rafId = requestAnimationFrame(function () {
        rafId = null;
        applyLight(pendingX, pendingY);
      });
    }
  });

  container.addEventListener("mouseleave", function () {
    cursorInside = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    var svg = container._mosaicSvg;
    if (!svg) return;
    svg._hovers.forEach(function (glow) { glow.style.opacity = "0"; });
  });

  container._applyMosaicLight = function () {
    if (cursorInside) applyLight(pendingX, pendingY);
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
    cleanupTimer = setTimeout(function () {
      cleanupTimer = null;
      svg._tiles.forEach(function (tile) {
        if (Math.abs(tile._col - pressTileCol) + Math.abs(tile._row - pressTileRow) > PRESS_RADIUS) return;
        tile.style.transform = "";
        tile.style.transition = "";
        tile.style.transformOrigin = "";
      });
    }, 500);
  }

  function triggerRipple(svg) {
    var col = pressTileCol, row = pressTileRow;
    var maxDist = svg._maxDist;

    svg._ripples.forEach(function (ripple) {
      var dc = ripple._col - col, dr = ripple._row - row;
      var dist = Math.sqrt(dc * dc + dr * dr);
      var delay = Math.round(dist * 35);
      var peak = (Math.max(0, 1 - dist / maxDist) * 0.90).toFixed(3);
      setTimeout(function () { ripple.style.opacity = peak; }, delay);
      setTimeout(function () { ripple.style.opacity = "0"; }, delay + 200);
    });
  }

  container.addEventListener("pointerdown", function (e) {
    var bounds = container.getBoundingClientRect();
    startPress(e.clientX - bounds.left, e.clientY - bounds.top);
  });

  pressRegistry.push(endPress);
}

function fitMosaics(animate) {
  document.querySelectorAll(".mosaic-overlay").forEach(function (overlay) {
    var p = overlay.parentElement;
    var target = parseInt(p.dataset.target) || 24;
    var W = p.offsetWidth;
    var H = p.offsetHeight;
    if (!W || !H) return;

    var dimsKey = W + "x" + H;
    if (!animate && p.dataset.mosaicDims === dimsKey) return;
    p.dataset.mosaicDims = dimsKey;

    if (!p.dataset.mosaicSeed) {
      p.dataset.mosaicSeed = Math.floor(Math.random() * 100000);
    }
    var seed = parseInt(p.dataset.mosaicSeed);

    var isCA = p.dataset.mosaicType === "ca";
    var isMobile = window.innerWidth <= 768;
    var mobileCols = parseInt(p.dataset.mobileCols);
    var cols = (isMobile && mobileCols) ? mobileCols : ((isCA ? Math.floor(W / target) : Math.round(W / target)) || 1);
    var rows = (isCA ? Math.floor(H / target) : Math.round(H / target)) || 1;
    var tw = W / cols;
    var th = H / rows;
    p.dataset.mosaicTw = tw;
    p.dataset.mosaicTh = th;
    p._tw = tw;
    p._th = th;

    var existing = p.querySelector(".mosaic-tiles-svg");
    var newSvg = p.dataset.mosaicType === "ca"
      ? buildCAMosaicSVG(W, H, cols, rows, tw, th, seed)
      : buildMosaicSVG(W, H, cols, rows, tw, th, seed);

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
      (existing._tiles || []).forEach(function (rect) {
        var d = Math.round((parseInt(rect.getAttribute("data-delay")) || 0) / 3);
        rect.style.animation = "tile-shrink 150ms ease-in " + d + "ms both";
      });
      shrinkTimer = setTimeout(function () {
        shrinkTimer = null;
        Array.from(p.querySelectorAll(".mosaic-tiles-svg")).forEach(function (s) { s.remove(); });
        p.appendChild(newSvg);
        p._mosaicSvg = newSvg;
      }, 200);
    } else {
      if (shrinkTimer) { clearTimeout(shrinkTimer); shrinkTimer = null; }
      if (existing) existing.remove();
      p.appendChild(newSvg);
      p._mosaicSvg = newSvg;
    }
  });
}

window.addEventListener("load", function () { fitMosaics(true); });

if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(function () { fitMosaics(false); });
}

window.addEventListener("resize", function () {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function () { fitMosaics(false); }, 100);
});

if (navigator.maxTouchPoints > 0 && !window.matchMedia("(pointer: fine)").matches) {
  document.addEventListener("gesturestart", function (e) { e.preventDefault(); });
  document.addEventListener("touchmove", function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
}
