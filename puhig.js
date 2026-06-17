var PALETTE = ["#0a0a0a", "#a8d8cc", "#e85d1a", "#f5f5f0"];
var shrinkTimer = null;
var resizeTimer = null;

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
      rect.style.setProperty("--delay", delay + "ms");
      rect.style.transformOrigin = ox + "% " + oy + "%";
      svg.appendChild(rect);
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
      rect.style.setProperty("--delay", delay + "ms");
      rect.style.transformOrigin = ox + "% " + oy + "%";
      svg.appendChild(rect);
    }
  }

  return svg;
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
    var cols = (isCA ? Math.floor(W / target) : Math.round(W / target)) || 1;
    var rows = (isCA ? Math.floor(H / target) : Math.round(H / target)) || 1;
    var tw = W / cols;
    var th = H / rows;

    var existing = p.querySelector(".mosaic-tiles-svg");
    var newSvg = p.dataset.mosaicType === "ca"
      ? buildCAMosaicSVG(W, H, cols, rows, tw, th, seed)
      : buildMosaicSVG(W, H, cols, rows, tw, th, seed);

    if (animate && existing) {
      if (shrinkTimer) clearTimeout(shrinkTimer);
      existing.querySelectorAll(".mosaic-tile").forEach(function (rect) {
        var d = Math.round((parseInt(rect.getAttribute("data-delay")) || 0) / 3);
        rect.style.animation = "tile-shrink 150ms ease-in " + d + "ms both";
      });
      shrinkTimer = setTimeout(function () {
        shrinkTimer = null;
        Array.from(p.querySelectorAll(".mosaic-tiles-svg")).forEach(function (s) { s.remove(); });
        p.appendChild(newSvg);
      }, 200);
    } else {
      if (shrinkTimer) { clearTimeout(shrinkTimer); shrinkTimer = null; }
      if (existing) existing.remove();
      p.appendChild(newSvg);
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
