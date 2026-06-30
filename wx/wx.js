// WX — a small weather app built on Pocket Universe.
//
// It demonstrates the puhig component vocabulary in a working product: results
// render as real trading-card sleeves in the panel grid — the same deck as the
// main HIG page — flipping and tilting like authored cards (puhig.js wires
// runtime-added .card-sleeve elements via its MutationObserver). Data comes
// from the U.S. National Weather Service API (api.weather.gov — free, key-less,
// CORS-open). One state picker drives two feeds: the forecast (keyed by a
// point) and active alerts (keyed by a state area), so each state carries its
// capital and that capital's coordinates.
(function () {
  "use strict";

  var API = "https://api.weather.gov";

  // name, postal abbreviation, capital, and the capital's lat/lon. The point
  // gives the forecast a concrete place to resolve; the abbreviation keys the
  // state-wide alerts feed.
  var STATES = [
    { name: "Alabama", abbr: "AL", capital: "Montgomery", lat: 32.377, lon: -86.3006 },
    { name: "Alaska", abbr: "AK", capital: "Juneau", lat: 58.3019, lon: -134.4197 },
    { name: "Arizona", abbr: "AZ", capital: "Phoenix", lat: 33.4484, lon: -112.074 },
    { name: "Arkansas", abbr: "AR", capital: "Little Rock", lat: 34.7465, lon: -92.2896 },
    { name: "California", abbr: "CA", capital: "Sacramento", lat: 38.5816, lon: -121.4944 },
    { name: "Colorado", abbr: "CO", capital: "Denver", lat: 39.7392, lon: -104.9903 },
    { name: "Connecticut", abbr: "CT", capital: "Hartford", lat: 41.7637, lon: -72.6851 },
    { name: "Delaware", abbr: "DE", capital: "Dover", lat: 39.1582, lon: -75.5244 },
    { name: "Florida", abbr: "FL", capital: "Tallahassee", lat: 30.4383, lon: -84.2807 },
    { name: "Georgia", abbr: "GA", capital: "Atlanta", lat: 33.749, lon: -84.388 },
    { name: "Hawaii", abbr: "HI", capital: "Honolulu", lat: 21.307, lon: -157.8583 },
    { name: "Idaho", abbr: "ID", capital: "Boise", lat: 43.615, lon: -116.2023 },
    { name: "Illinois", abbr: "IL", capital: "Springfield", lat: 39.7817, lon: -89.6501 },
    { name: "Indiana", abbr: "IN", capital: "Indianapolis", lat: 39.7684, lon: -86.1581 },
    { name: "Iowa", abbr: "IA", capital: "Des Moines", lat: 41.5868, lon: -93.625 },
    { name: "Kansas", abbr: "KS", capital: "Topeka", lat: 39.0473, lon: -95.6752 },
    { name: "Kentucky", abbr: "KY", capital: "Frankfort", lat: 38.2009, lon: -84.8733 },
    { name: "Louisiana", abbr: "LA", capital: "Baton Rouge", lat: 30.4515, lon: -91.1871 },
    { name: "Maine", abbr: "ME", capital: "Augusta", lat: 44.3106, lon: -69.7795 },
    { name: "Maryland", abbr: "MD", capital: "Annapolis", lat: 38.9784, lon: -76.4922 },
    { name: "Massachusetts", abbr: "MA", capital: "Boston", lat: 42.3601, lon: -71.0589 },
    { name: "Michigan", abbr: "MI", capital: "Lansing", lat: 42.7325, lon: -84.5555 },
    { name: "Minnesota", abbr: "MN", capital: "Saint Paul", lat: 44.9537, lon: -93.09 },
    { name: "Mississippi", abbr: "MS", capital: "Jackson", lat: 32.2988, lon: -90.1848 },
    { name: "Missouri", abbr: "MO", capital: "Jefferson City", lat: 38.5767, lon: -92.1735 },
    { name: "Montana", abbr: "MT", capital: "Helena", lat: 46.5891, lon: -112.0391 },
    { name: "Nebraska", abbr: "NE", capital: "Lincoln", lat: 40.8136, lon: -96.7026 },
    { name: "Nevada", abbr: "NV", capital: "Carson City", lat: 39.1638, lon: -119.7674 },
    { name: "New Hampshire", abbr: "NH", capital: "Concord", lat: 43.2081, lon: -71.5376 },
    { name: "New Jersey", abbr: "NJ", capital: "Trenton", lat: 40.2206, lon: -74.7597 },
    { name: "New Mexico", abbr: "NM", capital: "Santa Fe", lat: 35.687, lon: -105.9378 },
    { name: "New York", abbr: "NY", capital: "Albany", lat: 42.6526, lon: -73.7562 },
    { name: "North Carolina", abbr: "NC", capital: "Raleigh", lat: 35.7796, lon: -78.6382 },
    { name: "North Dakota", abbr: "ND", capital: "Bismarck", lat: 46.8083, lon: -100.7837 },
    { name: "Ohio", abbr: "OH", capital: "Columbus", lat: 39.9612, lon: -82.9988 },
    { name: "Oklahoma", abbr: "OK", capital: "Oklahoma City", lat: 35.4676, lon: -97.5164 },
    { name: "Oregon", abbr: "OR", capital: "Salem", lat: 44.9429, lon: -123.0351 },
    { name: "Pennsylvania", abbr: "PA", capital: "Harrisburg", lat: 40.2732, lon: -76.8867 },
    { name: "Rhode Island", abbr: "RI", capital: "Providence", lat: 41.824, lon: -71.4128 },
    { name: "South Carolina", abbr: "SC", capital: "Columbia", lat: 34.0007, lon: -81.0348 },
    { name: "South Dakota", abbr: "SD", capital: "Pierre", lat: 44.3683, lon: -100.351 },
    { name: "Tennessee", abbr: "TN", capital: "Nashville", lat: 36.1627, lon: -86.7816 },
    { name: "Texas", abbr: "TX", capital: "Austin", lat: 30.2672, lon: -97.7431 },
    { name: "Utah", abbr: "UT", capital: "Salt Lake City", lat: 40.7608, lon: -111.891 },
    { name: "Vermont", abbr: "VT", capital: "Montpelier", lat: 44.2601, lon: -72.5754 },
    { name: "Virginia", abbr: "VA", capital: "Richmond", lat: 37.5407, lon: -77.436 },
    { name: "Washington", abbr: "WA", capital: "Olympia", lat: 47.0379, lon: -122.9007 },
    { name: "West Virginia", abbr: "WV", capital: "Charleston", lat: 38.3498, lon: -81.6326 },
    { name: "Wisconsin", abbr: "WI", capital: "Madison", lat: 43.0731, lon: -89.4012 },
    { name: "Wyoming", abbr: "WY", capital: "Cheyenne", lat: 41.14, lon: -104.8202 }
  ];

  var selectEl = document.getElementById("wx-state");
  var resultsEl = document.getElementById("wx-results");
  if (!selectEl || !resultsEl) return;

  // A request token: every selection bumps it so a slow earlier fetch can't
  // paint over a newer selection's result when it finally lands.
  var requestId = 0;
  // Active alerts for the current render, indexed for the delegated Copy handler.
  var currentAlerts = [];
  // Animations from the in-flight deal, cancelled when a new deal supersedes it.
  var dealAnims = [];
  // How many result cards (forecast + alerts) to deal, set by the -/+ stepper.
  var REVEAL_MIN = 1, REVEAL_MAX = 8, revealLimit = 4;
  // The last data shown, so the stepper can re-deal at the new limit.
  var lastShown = null;

  // ---- small helpers -------------------------------------------------------

  function esc(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Trim NWS prose to fit a fixed-size card; the full text rides the Copy action.
  function trunc(text, n) {
    text = String(text == null ? "" : text);
    return text.length > n ? text.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : text;
  }

  function stateByAbbr(abbr) {
    for (var i = 0; i < STATES.length; i++) {
      if (STATES[i].abbr === abbr) return STATES[i];
    }
    return null;
  }

  function fmtTime(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleString([], {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
    });
  }

  function headlineOf(p) {
    return (p.parameters && p.parameters.NWSheadline && p.parameters.NWSheadline[0]) ||
      p.headline || p.event || "";
  }

  // ---- card builders (real deck sleeves, as strings) -----------------------

  // Wrap a card-frame body in the sleeve + flip-back boilerplate. The first
  // result card starts a fresh grid row, sitting below the cover + picker.
  function sleeve(inner, rowStart) {
    return (
      '<div class="panel-frame card-sleeve' + (rowStart ? " panel-row-start" : "") + '" data-row="wx">' +
        '<div class="panel-content card">' +
          '<div class="card-frame">' + inner + "</div>" +
        "</div>" +
        '<div class="card-back"><i class="ph ph-planet"></i></div>' +
      "</div>"
    );
  }

  function title(name, color) {
    return (
      '<div class="card-title"><span class="card-name">' + esc(name) + "</span>" +
        '<div class="card-cost"><span class="card-pip" style="background: ' + color + '"></span></div></div>'
    );
  }

  function typeRow(label, icon) {
    return (
      '<div class="card-type"><span class="card-type-label">' + esc(label) + "</span>" +
        '<i class="card-rarity ph ' + icon + '" data-rarity="stable"></i></div>'
    );
  }

  // The forecast lives in a fixed masthead card (WX 003, col 3): its body is
  // swapped in place — never dealt — through noteBody / forecastBody below. The
  // dealt cards (alerts, the clear-skies note) wrap a body in a sleeve instead.
  var FC_NUM = "WX 004"; // the forecast card's collector number / its column

  // A footer: a card-number on the left over a single metadata line.
  function footer(number, meta) {
    return (
      '<div class="card-footer"><div class="card-footer-left">' +
        '<span class="card-number">' + esc(number) + "</span>" +
        '<div class="card-metadata"><span class="card-language">' + esc(meta) + "</span></div>" +
      "</div></div>"
    );
  }

  // A note body carries the app's calm empty / loading / clear / error voice.
  function noteBody(icon, heading, body, number) {
    return (
      title("Weather", "var(--teal)") +
      typeRow("Reading", icon) +
      '<div class="card-text-box">' +
        '<p class="wx-note-title">' + esc(heading) + "</p>" +
        (body ? "<p>" + esc(body) + "</p>" : "") +
      "</div>" +
      footer(number, "EN")
    );
  }

  // The live forecast body (temperature + short / detailed prose).
  function forecastBody(place, period) {
    var wind = period.windSpeed ? period.windDirection + " " + period.windSpeed : "";
    return (
      title(place, "var(--teal)") +
      typeRow("Forecast — " + period.name, "ph-cloud-sun") +
      '<div class="card-text-box">' +
        '<div class="wx-temp"><span class="wx-temp-value">' + esc(period.temperature) + "</span>" +
          '<span class="wx-temp-unit">°' + esc(period.temperatureUnit) + "</span></div>" +
        '<p class="wx-short">' + esc(period.shortForecast) + "</p>" +
        "<p>" + esc(trunc(period.detailedForecast, 130)) + "</p>" +
      "</div>" +
      footer(FC_NUM, wind)
    );
  }

  // A dealt note sleeve (the "clear skies" / no-alerts card), numbered as a data
  // note (NWS) since it sits in the alerts region, not the masthead.
  function noteCard(icon, heading, body, rowStart) {
    return sleeve(noteBody(icon, heading, body, "NWS"), rowStart);
  }

  function alertCard(feature, index, rowStart) {
    var p = feature.properties || {};
    var headline = headlineOf(p);
    return sleeve(
      title(p.event || "Alert", "var(--orange)") +
      typeRow("Alert — " + (p.severity || "Unknown"), "ph-warning") +
      '<div class="card-text-box">' +
        '<p class="wx-area">📍 ' + esc(trunc(p.areaDesc || "", 80)) + "</p>" +
        (headline ? "<p>" + esc(trunc(headline, 120)) + "</p>" : "") +
        '<div class="card-stat">' +
          '<button class="btn btn--outline btn--sm" data-copy="' + index + '"><i class="ph ph-copy"></i>Copy</button>' +
        "</div>" +
      "</div>" +
      footer(fmtTime(p.effective), "until " + fmtTime(p.expires)),
      rowStart
    );
  }

  // ---- data ----------------------------------------------------------------

  function getJSON(url) {
    return fetch(url, { headers: { Accept: "application/geo+json" } }).then(function (r) {
      if (!r.ok) throw new Error("NWS responded " + r.status);
      return r.json();
    });
  }

  // Forecast is a two-hop lookup: a point resolves to its gridpoint, which
  // carries the forecast URL and a friendly relative-location name.
  function loadForecast(state) {
    return getJSON(API + "/points/" + state.lat + "," + state.lon).then(function (pt) {
      var props = pt.properties || {};
      var rel = props.relativeLocation && props.relativeLocation.properties;
      var place = rel ? rel.city + ", " + rel.state : "Near " + state.capital;
      return getJSON(props.forecast).then(function (fc) {
        var periods = (fc.properties && fc.properties.periods) || [];
        return { place: place, period: periods[0] || null };
      });
    });
  }

  function loadAlerts(state) {
    return getJSON(API + "/alerts/active/area/" + state.abbr).then(function (data) {
      return (data && data.features) || [];
    });
  }

  // ---- render --------------------------------------------------------------
  // The masthead carries two JS-managed cards: the idle note (WX 002, col 3 —
  // set once on load and kept) and, on selection, a forecast card (WX 004) built
  // in its own host to the right (col 5). Alerts share the results region (row 2
  // onward); their first card starts that row.

  function render(html) {
    resultsEl.innerHTML = html;
  }

  var NOTE_NUM = "WX 002"; // the kept idle-note card's column number

  // The idle note (WX 002, col 3): its body is set once on load (and on the
  // placeholder re-select) and then left as-is — it never shows the forecast.
  var noteEl = document.getElementById("wx-note");
  function setNote(body) {
    if (noteEl) noteEl.innerHTML = body;
  }

  // The forecast card (WX 004) lives in its own host to the right (col 5),
  // created on selection and updated in place — no deal animation. The sleeve is
  // built once (so puhig.js's flip-init survives) and only its card-frame body
  // swaps; clearForecast removes the card entirely (the idle masthead).
  var forecastHost = document.getElementById("wx-forecast");
  function forecastFrame() {
    if (!forecastHost) return null;
    var f = forecastHost.querySelector("#wx-forecast-body");
    if (!f) {
      forecastHost.innerHTML =
        '<div class="panel-frame card-sleeve" data-row="wx" data-wx-slot="forecast">' +
          '<div class="panel-content card"><div class="card-frame" id="wx-forecast-body" aria-live="polite"></div></div>' +
          '<div class="card-back"><i class="ph ph-planet"></i></div>' +
        "</div>";
      f = forecastHost.querySelector("#wx-forecast-body");
    }
    return f;
  }
  function setForecast(body) {
    var f = forecastFrame();
    if (f) f.innerHTML = body;
  }
  function clearForecast() {
    if (forecastHost) forecastHost.innerHTML = "";
  }

  // Deal animation: the WX cover is a portal. On a selection it cycles open in
  // one continuous beat:
  // (1) The cover's face recedes a touch (a 2D scale on its front, .panel-content)
  //     while the mosaic behind it zooms in — a vortex opening. (The face scale
  //     keeps the no-op rotateY(0) that enrols it in the flip's 3D context.)
  // (2) The dealt cards — the forecast card (WX 004, col 5) leading, then the
  //     alert cards (row 2) — are born at the mosaic's centre, tiny (scale 0.16)
  //     and faded, then fly out to their grid slots one at a time, growing to
  //     full size and opacity, staggered.
  // (3) As the last card lands the portal eases back to rest (face + mosaic).
  // FLIP-style: each card already occupies its final slot, so only transform +
  // opacity animate (no reflow). fill:none on every animation, so the cover face,
  // the mosaic and the cards all revert to their rest pose when the deal ends and
  // on cancel. Skipped under prefers-reduced-motion.
  var reduceMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");

  // Shared deal motion: a card is born tiny at the cover's centre (bornScale),
  // flies out on EASE, and lands a touch over-grown (growScale) before settling —
  // the spit-out's inertia. Used by both the selection deal and the load entry.
  var EASE = "cubic-bezier(0.2, 0.7, 0.25, 1)";
  var bornScale = 0.16; // size of a card at the vortex centre before it flies out
  var growScale = 1.05; // a card overshoots its rest size on landing, then settles

  // The cover's animatable parts: the sleeve (deal origin / rect, scaled to
  // recede) and the mosaic tile SVG inside it (scaled to zoom).
  function coverParts() {
    var frame = document.querySelector('[data-row="wx"] .card-frame--cover');
    return {
      sleeve: frame ? frame.closest(".card-sleeve") : null,
      mosaic: frame ? frame.querySelector(".mosaic-tiles-svg") : null
    };
  }

  // The masthead: the cover's sibling sleeves (About, the idle note, Location) on
  // the cover's own row — not the nested forecast/results sections. These are what
  // the load entry spits out from the cover's centre.
  function mastCards() {
    var cover = coverParts();
    if (!cover.sleeve) return [];
    return Array.prototype.slice.call(cover.sleeve.parentNode.children).filter(function (el) {
      return el.classList && el.classList.contains("card-sleeve") && el.getAttribute("data-wx-slot") !== "cover";
    });
  }

  // The portal pulse: the whole cover card (its .card-sleeve) recedes
  // (faceScale < 1) while the mosaic inside it zooms (zoomScale > 1, so the
  // tiles' net scale faceScale×zoomScale still reads as a zoom-in) — the vortex
  // opening. Both hold between peakAt and closeAt (offsets in [0,1] of `total`)
  // then settle back to rest. The sleeve has no resting transform (the flip only
  // sets one during interaction, which doesn't happen mid-deal); fill:none
  // reverts both on end / cancel. Returns the WAAPI animations so the caller can
  // track + cancel them.
  // The optional inhale (inhaleScale < 1 at inhaleAt, before peakAt) gives the
  // zoom a breath: the mosaic contracts first, then expands past rest to spit the
  // cards out — a draw-in before the blow-out. Omit it (as the gather does, being
  // an inhale already) for a plain exhale.
  function portalPulse(sleeve, mosaic, total, peakAt, closeAt, faceScale, zoomScale, inhaleScale, inhaleAt) {
    var anims = [];
    if (sleeve) {
      anims.push(sleeve.animate(
        [
          { transform: "none", offset: 0, easing: "ease-out" },
          { transform: "scale(" + faceScale + ")", offset: peakAt, easing: "ease-in-out" },
          { transform: "scale(" + faceScale + ")", offset: closeAt, easing: "ease-in-out" },
          { transform: "none", offset: 1 }
        ],
        { duration: total, easing: "linear" }
      ));
    }
    if (mosaic) {
      mosaic.style.transformOrigin = "center"; // zoom about the vortex centre, not the SVG origin
      var frames = [{ transform: "scale(1)", offset: 0, easing: "ease-in-out" }];
      // Breath in (contract) before the zoom, so the exhale that follows reads as
      // a push that throws the cards out, not a flat opening. The inhale eases in
      // AND out (ease-in-out) so it settles to zero velocity at the bottom of the
      // breath and the exhale swings out from rest — no snap at the turn.
      if (inhaleScale != null) {
        frames.push({ transform: "scale(" + inhaleScale + ")", offset: inhaleAt, easing: "ease-in-out" });
      }
      frames.push({ transform: "scale(" + zoomScale + ")", offset: peakAt, easing: "ease-in-out" });
      frames.push({ transform: "scale(" + zoomScale + ")", offset: closeAt, easing: "ease-in-out" });
      frames.push({ transform: "scale(1)", offset: 1 });
      anims.push(mosaic.animate(frames, { duration: total, easing: "linear" }));
    }
    return anims;
  }

  // Every card that rides the portal: the forecast card (WX 004, col 5) leads,
  // then the alert cards (row 2). Both are born from / gathered into the cover.
  function dealableCards() {
    var list = [];
    if (forecastHost) list = list.concat(Array.prototype.slice.call(forecastHost.querySelectorAll(":scope > .card-sleeve")));
    return list.concat(Array.prototype.slice.call(resultsEl.querySelectorAll(":scope > .card-sleeve")));
  }

  function dealIn() {
    if (reduceMotionMQ.matches) return;
    var cards = dealableCards();
    if (!cards.length) return;

    // Cancel any still-running prior deal (e.g. a rapid re-click) so its
    // late-firing onfinish — which runs on the now-detached old cards — can't
    // clear a card z-index that this new deal is about to set.
    for (var k = 0; k < dealAnims.length; k++) { try { dealAnims[k].cancel(); } catch (e) {} }
    dealAnims = [];

    // The cover is the portal: cards are dealt from its centre. Fall back to the
    // first result slot if the cover can't be found (defensive).
    var cover = coverParts();

    // Read every final rect first (one layout pass), then animate transforms.
    var rects = cards.map(function (c) { return c.getBoundingClientRect(); });
    var base = cover.sleeve ? cover.sleeve.getBoundingClientRect() : rects[0];

    var lastIdx = cards.length - 1;
    var openDur = 280;   // the portal opens: face recedes, mosaic zooms in
    var emitDelay = 150; // first card is born once the vortex has cracked open
    var emitStep = 110;  // gap between successive cards emerging
    var emitDur = 480;   // one card's flight from the vortex centre to its slot
    var settleDur = 160; // the spit-out inertia: a card arrives over-grown, then relaxes to rest
    var closeDur = 320;  // the portal eases back to rest behind the last card

    var lastLand = emitDelay + lastIdx * emitStep + emitDur + settleDur;
    var closeStart = Math.max(openDur, lastLand - settleDur - 140); // overlap the close with the last landing
    var total = Math.max(lastLand, closeStart + closeDur);

    dealAnims = portalPulse(
      cover.sleeve, cover.mosaic, total,
      openDur / total, closeStart / total, 0.95, 1.32,
      0.88, 110 / total // breath in before the exhale spits the cards
    );

    // The animation easing is linear so each keyframe's `offset` lands at its
    // intended time; the moving segment carries its own easing. (EASE, bornScale,
    // growScale are shared with the load entry — defined above.)
    cards.forEach(function (card, i) {
      var r = rects[i];
      // All sleeves are the same size, so aligning top-left aligns centres; the
      // scale then shrinks the card to a tile sitting at the cover's centre.
      var bornT = "translate(" + (base.left - r.left) + "px, " + (base.top - r.top) + "px) scale(" + bornScale + ")";
      var emitStart = emitDelay + i * emitStep;
      var emitEnd = emitStart + emitDur;
      var settleEnd = emitEnd + settleDur;

      // offset 0 → (wait at centre, hidden) → fade in from near-nothing as it flies
      // out to its slot, arriving a touch over-grown (momentum) → settle back to
      // rest. The fade spans the whole flight, mirroring the gather's fade-to-zero
      // as a card is sucked in: a card is born faint at the vortex and resolves as
      // it emerges, not popped to full opacity while still in the portal.
      var frames = [
        { transform: bornT, opacity: 0, offset: 0 },
        { transform: bornT, opacity: 0, offset: emitStart / total, easing: EASE },
        { transform: "scale(" + growScale + ")", opacity: 1, offset: emitEnd / total, easing: "ease-out" },
        { transform: "none", opacity: 1, offset: settleEnd / total }
      ];
      if (settleEnd < total) frames.push({ transform: "none", opacity: 1, offset: 1 });

      card.style.zIndex = String(100 - i); // first card out sits in front of the fan
      var anim = card.animate(frames, { duration: total, easing: "linear" });
      dealAnims.push(anim);
      anim.onfinish = function () { card.style.zIndex = ""; };
    });
  }

  // One-time page-load entry. The cover card pops in (a quick scale-up carrying
  // the same growth inertia as a deal), then the static masthead cards — About
  // (001), the idle note (002), Location (003) — are spat out from the cover's
  // centre, born tiny and flying to their slots. This is the masthead's only
  // animation; selections animate the forecast + alerts, never these. Skipped
  // under reduced motion. When we arrive through the cross-document cover portal
  // (viaPortal), that morph IS the cover's entry, so we leave the cover alone and
  // only spit the masthead — popping it would break the portal's morph target.
  var entryAnims = [];
  function entryDeal(viaPortal) {
    if (reduceMotionMQ.matches) return;
    var cover = coverParts();
    if (!cover.sleeve) return;
    var mast = mastCards();
    if (!mast.length) return;

    var base = cover.sleeve.getBoundingClientRect();
    var rects = mast.map(function (c) { return c.getBoundingClientRect(); });

    var popDur = 360;     // the cover pops in (direct load only)
    var emitDelay = 300;  // the first masthead card emerges as the cover settles
    var emitStep = 90;    // gap between successive masthead cards
    var emitDur = 460;    // one card's flight from the cover centre to its slot
    var settleDur = 160;  // the spit-out inertia (matches the selection deal)
    var closeDur = 300;   // the mosaic eases back to rest behind the last card

    var lastIdx = mast.length - 1;
    var lastLand = emitDelay + lastIdx * emitStep + emitDur + settleDur;
    var closeStart = Math.max(emitDelay, lastLand - settleDur - 140);
    var total = Math.max(lastLand, closeStart + closeDur);

    // Direct load: pop the cover in, then open the portal (mosaic zoom) as the
    // masthead spits. Via portal: the cover is mid-morph — touch neither.
    if (!viaPortal) {
      entryAnims.push(cover.sleeve.animate(
        [
          { transform: "scale(0.84)", opacity: 0, easing: EASE },
          { transform: "scale(" + growScale + ")", opacity: 1, offset: 0.78, easing: "ease-out" },
          { transform: "none", opacity: 1 }
        ],
        { duration: popDur + 140 }
      ));
      entryAnims = entryAnims.concat(portalPulse(
        null, cover.mosaic, total, emitDelay / total, closeStart / total, 1, 1.28,
        0.88, 140 / total // breath in before the exhale spits the masthead out
      ));
    }

    mast.forEach(function (card, i) {
      var r = rects[i];
      var bornT = "translate(" + (base.left - r.left) + "px, " + (base.top - r.top) + "px) scale(" + bornScale + ")";
      var emitStart = emitDelay + i * emitStep;
      var emitEnd = emitStart + emitDur;
      var settleEnd = emitEnd + settleDur;

      // Fade in over the whole flight (mirrors the gather's fade-out), so the card
      // emerges faint from the vortex rather than popping to full opacity in it.
      var frames = [
        { transform: bornT, opacity: 0, offset: 0 },
        { transform: bornT, opacity: 0, offset: emitStart / total, easing: EASE },
        { transform: "scale(" + growScale + ")", opacity: 1, offset: emitEnd / total, easing: "ease-out" },
        { transform: "none", opacity: 1, offset: settleEnd / total }
      ];
      if (settleEnd < total) frames.push({ transform: "none", opacity: 1, offset: 1 });

      card.style.zIndex = String(100 - i);
      var anim = card.animate(frames, { duration: total, easing: "linear" });
      entryAnims.push(anim);
      // The running deal holds the card hidden (opacity 0 at offset 0) then brings
      // it in, so clearing the pre-deal hide now reveals it through the deal, not in
      // a flash; without this it would snap back to the inline opacity:0 on finish.
      card.style.opacity = "";
      anim.onfinish = function () { card.style.zIndex = ""; };
    });
  }

  // Play the entry exactly once. Prefer pagereveal — it fires before the first
  // paint and tells us (via e.viewTransition) whether the cover portal is morphing
  // us in, and applying the born-at-centre poses there hides the masthead from the
  // portal's snapshot so it deals in cleanly afterwards. Fall back to an immediate
  // run for browsers without cross-document View Transitions (no portal there).
  var entryPlayed = false;
  function playEntry(viaPortal) {
    if (entryPlayed) return;
    entryPlayed = true;
    entryDeal(viaPortal);
  }

  // Fly-out: the reverse of the deal. Before a re-read (a new state, a cached
  // re-click) replaces the current cards, they fly back into the cover's mosaic —
  // shrinking to the vortex centre and fading — so the old reading reads as drawn
  // back into the portal the new one will be dealt from. The portal inhales (the
  // mosaic zooms in to draw them) then settles to rest before the next deal opens
  // it again. Front card leaves first, staggered back; all pass over the cover
  // (raised z-index) as they're pulled in. Cancelled and superseded the same way
  // the deal is, via flyAnims + a token.
  var flyAnims = [];
  var transitionId = 0;

  function flyOut(cards, done) {
    for (var k = 0; k < flyAnims.length; k++) { try { flyAnims[k].cancel(); } catch (e) {} }
    flyAnims = [];
    // Cancel any deal still in flight on these cards (a slow fetch can resolve
    // while the loading note is mid-deal): cancelling reverts them to their rest
    // slots, so the gather reads true rects and the two don't fight on transform.
    for (var d = 0; d < dealAnims.length; d++) { try { dealAnims[d].cancel(); } catch (e) {} }
    dealAnims = [];

    var cover = coverParts();
    var base = cover.sleeve ? cover.sleeve.getBoundingClientRect() : cards[0].getBoundingClientRect();

    var EASE = "cubic-bezier(0.4, 0, 0.7, 0.3)"; // accelerate into the vortex
    var perDur = 340;   // one card's flight back into the portal
    var step = 90;      // gap between successive cards leaving
    var lastIdx = cards.length - 1;
    var total = lastIdx * step + perDur;

    // The portal inhales — a gentler pulse than the deal's, peaking mid-gather
    // and settling to rest by the end so the next deal opens from a clean cover.
    flyAnims = portalPulse(cover.sleeve, cover.mosaic, total, 0.6, 0.85, 0.97, 1.18);

    var pending = cards.length;
    function settle() {
      if (--pending > 0) return;
      done();
    }

    cards.forEach(function (card, i) {
      var r = card.getBoundingClientRect();
      // Shrink to a tile at the cover's centre (same born-size as the deal) as it
      // fades — the mirror of a card being born from the vortex.
      var t = "translate(" + (base.left - r.left) + "px, " + (base.top - r.top) + "px) scale(0.16)";
      var start = i * step;
      card.style.zIndex = String(100 - i); // front card on top, sucked in first
      var anim = card.animate(
        [
          { transform: "none", opacity: 1, offset: 0 },
          { transform: "none", opacity: 1, offset: start / total, easing: EASE },
          { transform: t, opacity: 0, offset: (start + perDur) / total },
          { transform: t, opacity: 0, offset: 1 }
        ],
        { duration: total, easing: "linear" }
      );
      flyAnims.push(anim);
      // onfinish only on a clean run; cancellation (a superseding transition)
      // leaves `done` unfired — the new transition drives the next render.
      anim.onfinish = settle;
    });
  }

  // Run `after` (which renders the next view) once the current dealt cards — the
  // forecast card and any alerts — have flown back into the portal. Instant under
  // reduced motion, or when nothing is shown yet (nothing to gather). The token
  // lets a newer transition supersede a gather still in flight.
  function clearThen(after) {
    var existing = dealableCards();
    if (reduceMotionMQ.matches || !existing.length) { after(); return; }
    var token = ++transitionId;
    flyOut(existing, function () {
      if (token !== transitionId) return;
      after();
    });
  }

  // The idle masthead: the kept note (col 3) shows its empty voice, the forecast
  // card and the alerts region are cleared. Used on load and the placeholder
  // re-select. The note is set here every time but its content never varies — it
  // stays as it is on load. (FC_NUM is unused here; the note carries NOTE_NUM.)
  function renderEmpty() {
    setNote(noteBody(
      "ph-compass",
      "The sky, unread.",
      "Choose a state to draw its current forecast and any active weather alerts.",
      NOTE_NUM
    ));
    clearForecast();
    render("");
  }

  // Set the forecast card's body and render the alerts (+ a clear-skies note when
  // there are none), then deal the forecast card and alerts in together from the
  // portal. Shared by the live fetch and the cached test fixture.
  function showResults(stateName, forecast, alerts) {
    lastShown = { stateName: stateName, forecast: forecast, alerts: alerts };

    if (forecast && forecast.period) {
      setForecast(forecastBody(forecast.place, forecast.period));
    } else if (!forecast && !alerts) {
      // Both feeds failed: the forecast card carries the error (and deals in too).
      setForecast(noteBody(
        "ph-cloud-slash",
        "The signal didn't reach us.",
        "The National Weather Service couldn't be read just now. Try again in a moment.",
        FC_NUM
      ));
    } else {
      // Alerts came through but no forecast — note it on the card.
      setForecast(noteBody("ph-cloud-slash", "Forecast unavailable.", "No current forecast for " + stateName + ".", FC_NUM));
    }

    // Cap the alert deal at the stepper's reveal limit.
    var cards = [];
    if (alerts && alerts.length) {
      currentAlerts = alerts;
      for (var i = 0; i < alerts.length && cards.length < revealLimit; i++) {
        cards.push(alertCard(alerts[i], i, cards.length === 0));
      }
    } else if (alerts) {
      cards.push(noteCard("ph-sun", "Clear skies.", "No active alerts for " + stateName + ".", true));
    }

    render(cards.join(""));
    dealIn(); // the forecast card (col 5) + any alerts (row 2) deal in from the portal
  }

  function onSelect() {
    var state = stateByAbbr(selectEl.value);
    if (!state) { clearThen(renderEmpty); return; }

    var token = ++requestId;
    currentAlerts = [];

    // The old forecast card + alerts gather back into the portal while the fetch
    // runs in parallel; the new forecast + alerts deal out once BOTH the gather
    // and the fetch are done (whichever lands later drives it), guarded on `token`
    // so a newer selection wins. (The portal inhale/exhale is the loading cue —
    // there's no separate loading card.)
    var fetched = null, fetchDone = false, gatherDone = false;
    function maybeShow() {
      if (token === requestId && fetchDone && gatherDone) {
        showResults(state.name, fetched[0], fetched[1]);
      }
    }

    clearThen(function () { // gather the old forecast + alerts into the portal
      if (token !== requestId) return;
      gatherDone = true;
      maybeShow();
    });

    Promise.all([
      loadForecast(state).catch(function () { return null; }),
      loadAlerts(state).catch(function () { return null; })
    ]).then(function (out) {
      if (token !== requestId) return; // a newer selection has taken over
      fetched = out;
      fetchDone = true;
      maybeShow();
    });
  }

  // A frozen NWS fixture (Iowa) for testing the render + deal animation without
  // hitting the API. Shapes mirror loadForecast()/loadAlerts() exactly.
  var CACHED_IOWA = {
    forecast: {
      place: "Des Moines, IA",
      period: {
        name: "This Afternoon",
        temperature: 84,
        temperatureUnit: "F",
        shortForecast: "Sunny",
        detailedForecast: "Sunny, with a high near 84. Northwest wind 5 to 10 mph, with gusts as high as 20 mph.",
        windSpeed: "5 to 10 mph",
        windDirection: "NW"
      }
    },
    alerts: [
      { properties: {
        event: "Severe Thunderstorm Warning", severity: "Severe",
        areaDesc: "Polk, IA; Dallas, IA; Story, IA; Boone, IA",
        parameters: { NWSheadline: ["SEVERE THUNDERSTORM WARNING IN EFFECT UNTIL 6 PM CDT"] },
        effective: "2026-06-29T16:20:00-05:00", expires: "2026-06-29T18:00:00-05:00"
      } },
      { properties: {
        event: "Flood Watch", severity: "Moderate",
        areaDesc: "Polk, IA; Warren, IA; Madison, IA; Jasper, IA",
        parameters: { NWSheadline: ["FLOOD WATCH REMAINS IN EFFECT THROUGH LATE TONIGHT"] },
        effective: "2026-06-29T14:00:00-05:00", expires: "2026-06-30T01:00:00-05:00"
      } },
      { properties: {
        event: "Tornado Watch", severity: "Severe",
        areaDesc: "Polk, IA; Dallas, IA; Marion, IA; Jasper, IA",
        parameters: { NWSheadline: ["TORNADO WATCH IN EFFECT UNTIL 9 PM CDT"] },
        effective: "2026-06-29T15:30:00-05:00", expires: "2026-06-29T21:00:00-05:00"
      } },
      { properties: {
        event: "Heat Advisory", severity: "Minor",
        areaDesc: "Polk, IA; Story, IA; Boone, IA; Marshall, IA",
        parameters: { NWSheadline: ["HEAT ADVISORY REMAINS IN EFFECT UNTIL 8 PM CDT"] },
        effective: "2026-06-29T12:00:00-05:00", expires: "2026-06-29T20:00:00-05:00"
      } },
      { properties: {
        event: "Flash Flood Warning", severity: "Severe",
        areaDesc: "Polk, IA; Warren, IA; Madison, IA",
        parameters: { NWSheadline: ["FLASH FLOOD WARNING IN EFFECT UNTIL 7 PM CDT"] },
        effective: "2026-06-29T16:45:00-05:00", expires: "2026-06-29T19:00:00-05:00"
      } }
    ]
  };

  function loadCached() {
    selectEl.value = "IA";       // reflect the fixture in the dropdown
    var token = ++requestId;     // cancel any in-flight live fetch
    currentAlerts = [];
    clearThen(function () {      // gather old alerts, then show the fixture
      if (token === requestId) showResults("Iowa", CACHED_IOWA.forecast, CACHED_IOWA.alerts);
    });
  }

  // Copy buttons share one delegated listener over the results region.
  resultsEl.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-copy]");
    if (!btn) return;
    var feature = currentAlerts[Number(btn.getAttribute("data-copy"))];
    if (!feature) return;
    var p = feature.properties || {};
    var text = (p.areaDesc || "") + "\n\n" + headlineOf(p);
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {});
    var icon = btn.querySelector("i");
    if (icon) icon.className = "ph ph-check";
  });

  // ---- init ----------------------------------------------------------------

  function populate() {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < STATES.length; i++) {
      var opt = document.createElement("option");
      opt.value = STATES[i].abbr;
      opt.textContent = STATES[i].name;
      frag.appendChild(opt);
    }
    selectEl.appendChild(frag);
  }

  // The -/+ stepper sets how many result cards are dealt; nudging it re-deals
  // the last-shown reading at the new limit so the change is visible at once.
  var countEl = document.getElementById("wx-reveal-count");
  var lessBtn = document.getElementById("wx-reveal-less");
  var moreBtn = document.getElementById("wx-reveal-more");

  function syncStepper() {
    if (countEl) countEl.textContent = String(revealLimit);
    if (lessBtn) lessBtn.disabled = revealLimit <= REVEAL_MIN;
    if (moreBtn) moreBtn.disabled = revealLimit >= REVEAL_MAX;
  }

  function stepReveal(delta) {
    var next = Math.min(REVEAL_MAX, Math.max(REVEAL_MIN, revealLimit + delta));
    if (next === revealLimit) return;
    revealLimit = next;
    syncStepper();
    if (lastShown) showResults(lastShown.stateName, lastShown.forecast, lastShown.alerts);
  }

  populate();
  selectEl.addEventListener("change", onSelect);
  var cachedBtn = document.getElementById("wx-cached");
  if (cachedBtn) cachedBtn.addEventListener("click", loadCached);
  if (lessBtn) lessBtn.addEventListener("click", function () { stepReveal(-1); });
  if (moreBtn) moreBtn.addEventListener("click", function () { stepReveal(1); });
  syncStepper();
  // The forecast card's idle state is set in place (no deal, so no rect read) —
  // render it straight away; the alerts region starts empty.
  renderEmpty();

  // Pre-deal hide: the masthead siblings start invisible (opacity only — their
  // slots stay laid out so the deal reads true rects) until the entry spits them
  // from the cover's centre. Without this they sit at rest in the first paint —
  // and, arriving through the portal, in the view-transition snapshot — then jerk
  // back to the cover to deal. The cover itself is never hidden: on a direct load
  // its pop fades it in; through the portal it is the morph target. Skipped under
  // reduced motion, where no deal runs to reveal them.
  if (!reduceMotionMQ.matches) {
    mastCards().forEach(function (c) { c.style.opacity = "0"; });
  }

  // Page-load entry: cover pops in, then the masthead spits from its centre. Once.
  // pagereveal (where it fires) is preferred — it runs before the first paint and
  // reports, via e.viewTransition, whether the cover portal is morphing us in. A
  // cross-document portal arrival, though, doesn't reliably deliver pagereveal to
  // the new page, so we also arm a load fallback; whichever lands first plays the
  // entry. The fallback reads the portal arrival from the exit origin puhig stashes
  // in sessionStorage as it leaves the deck, consuming it so a later direct reload
  // reads as a direct load (cover pops) rather than a portal arrival (cover held).
  if ("onpagereveal" in window) {
    window.addEventListener("pagereveal", function (e) { playEntry(!!e.viewTransition); });
  }
  window.addEventListener("load", function () {
    var viaPortal = sessionStorage.getItem("vt-exit-origin") != null;
    sessionStorage.removeItem("vt-exit-origin");
    playEntry(viaPortal);
  });
})();
