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

  // A footer: a card-number on the left over a metadata line, plus optional extras
  // that match the static masthead cards' footers — opts.setAbbr renders a set
  // abbreviation (the data source, e.g. "NWS") before the language/meta value, and
  // opts.author renders an author on the right. Omit opts for the bare data-card
  // footer (number + a single meta value).
  function footer(number, meta, opts) {
    opts = opts || {};
    var setAbbr = opts.setAbbr
      ? '<span class="card-set-abbreviation">' + esc(opts.setAbbr) + "</span>"
      : "";
    var right = opts.author
      ? '<div class="card-footer-right"><span class="card-author">' + esc(opts.author) + "</span></div>"
      : "";
    return (
      '<div class="card-footer"><div class="card-footer-left">' +
        '<span class="card-number">' + esc(number) + "</span>" +
        '<div class="card-metadata">' + setAbbr +
          '<span class="card-language">' + esc(meta) + "</span></div>" +
      "</div>" + right + "</div>"
    );
  }

  // A note body carries the app's calm empty / loading / clear / error voice.
  // opts (optional) flows to footer — e.g. the masthead idle note passes the set
  // abbreviation + author to match its static siblings.
  function noteBody(icon, heading, body, number, opts) {
    return (
      title("Weather", "var(--teal)") +
      typeRow("Reading", icon) +
      '<div class="card-text-box">' +
        '<p class="wx-note-title">' + esc(heading) + "</p>" +
        (body ? "<p>" + esc(body) + "</p>" : "") +
      "</div>" +
      footer(number, "EN", opts)
    );
  }

  // The live forecast body (temperature + short / detailed prose).
  // Recolour the forecast mosaic by the weather: a condition (thunder, snow, rain,
  // fog) sets the mood directly; otherwise the temperature picks a warm→cool ramp.
  // The names resolve to --<name>-1..7 in wx.css; mild weather and fog reuse the
  // framework's own teal / gray palettes.
  function forecastPalette(period) {
    var cond = (period.shortForecast || "").toLowerCase();
    if (/thunder|lightning|t-?storm|tstm/.test(cond)) return "storm";
    if (/snow|sleet|ic(e|y)|flurr|wintry|blizzard|freezing|frost/.test(cond)) return "snow";
    if (/rain|shower|drizzle|storm/.test(cond)) return "rain";
    if (/fog|haze|mist|smoke/.test(cond)) return "gray";
    var t = parseFloat(period.temperature); // NaN for missing (Number(null) is 0)
    if (period.temperatureUnit === "C") t = t * 9 / 5 + 32; // ramp thresholds are °F
    if (isNaN(t)) return "teal";
    if (t >= 85) return "hot";
    if (t >= 68) return "warm";
    if (t >= 55) return "teal"; // mild — the app's default cool-teal
    return "cool";              // cold
  }

  function forecastBody(place, period, generatedAt) {
    // When NWS generated the forecast (properties.generatedAt), formatted like the
    // alert cards' times and labelled — parallel to the alerts' "until <time>".
    var at = fmtTime(generatedAt);
    return (
      title(place, "var(--teal)") +
      typeRow("Forecast — " + period.name, "ph-cloud-sun") +
      // The temperature + short forecast sit over the card's mosaic art, laid into a
      // figure above the tiles. The palette tracks the weather (forecastPalette).
      // data-mosaic-static: built once by fitMosaics, no entry stagger. The detailed
      // forecast stays below in the text box.
      '<div class="card-art" data-mosaic-type="ca" data-target="24" data-mosaic-align="left" data-mosaic-palette="' + forecastPalette(period) + '" data-mosaic-static>' +
        '<div class="mosaic-overlay card-mosaic"></div>' +
        '<div class="wx-forecast-figure">' +
          '<div class="wx-temp"><span class="wx-temp-value">' + esc(period.temperature) + "</span>" +
            '<span class="wx-temp-unit">°' + esc(period.temperatureUnit) + "</span></div>" +
          '<p class="wx-short">' + esc(period.shortForecast) + "</p>" +
        "</div>" +
      "</div>" +
      '<div class="card-text-box">' +
        "<p>" + esc(trunc(period.detailedForecast, 130)) + "</p>" +
      "</div>" +
      footer(FC_NUM, at ? "Forecasted at " + at : "")
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
        var fcProps = fc.properties || {};
        var periods = fcProps.periods || [];
        // generatedAt is when NWS produced the forecast — the "forecasted at" time.
        return { place: place, period: periods[0] || null, generatedAt: fcProps.generatedAt || "" };
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

  // The cover-portal animation toolkit the HIG framework provides (window.puhig.
  // portal, from puhig.js — loaded before this script). WX animates its own cover
  // with these shared primitives — the portal pulse, the deal timing, the card
  // fly-out and the cover breath — instead of re-implementing them, so the deck
  // deals with the same motion as every HIG cover and a tweak to that motion is one
  // edit in the framework, not one per app.
  var portal = window.puhig.portal;

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
  // the load entry spits out from the cover's centre. Dev cards (data-wx-slot
  // "dev-*") also live in this row but are static scaffolding — excluded so the
  // entry deal doesn't spit them and the pre-deal hide doesn't blank them.
  function mastCards() {
    var cover = coverParts();
    if (!cover.sleeve) return [];
    return Array.prototype.slice.call(cover.sleeve.parentNode.children).filter(function (el) {
      var slot = (el.getAttribute && el.getAttribute("data-wx-slot")) || "";
      return el.classList && el.classList.contains("card-sleeve") && slot !== "cover" && slot.indexOf("dev") !== 0;
    });
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

    // The portal opens (openDur) before the first card emerges, and is the floor for
    // the close. Timing maths + the spit-out itself come from the framework toolkit.
    var openDur = 280;
    var t = portal.dealTiming(cards.length, {
      emitDelay: 150, emitStep: 110, emitDur: 480, settleDur: 160, closeDur: 320,
      closeFloor: openDur
    });

    // Open the portal (the face recedes a touch, the mosaic zooms), then spit the
    // cards out from its centre. Track every animation in dealAnims so a rapid
    // re-click can cancel them. Cards are freshly injected (already visible) so no
    // pre-deal hide to clear.
    dealAnims = portal.pulse(
      cover.sleeve, cover.mosaic, t.total,
      openDur / t.total, t.closeStart / t.total, 0.95, 1.32,
      0.88, 110 / t.total // breath in before the exhale spits the cards
    );
    dealAnims = dealAnims.concat(portal.dealCards(cards, base, rects, t, {}));
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

    var t = portal.dealTiming(mast.length, {
      emitDelay: 300, emitStep: 90, emitDur: 460, settleDur: 160, closeDur: 300
    });

    // Direct load: breathe the cover in, then open the portal (mosaic zoom) as the
    // masthead spits. Via portal: the cover is mid-morph — touch neither.
    // The masthead is the page's first impression — a more prominent entry: the cover
    // is born noticeably small so it visibly grows in (coverFrom 0.62), with a deeper
    // outward vortex breath (zoom 1.5), and synced so the frame and mosaic breathe as
    // one — the cover swells to its overshoot as the vortex peaks, holds across the
    // plateau, then settles to rest on the vortex's close (see portal.coverBreath).
    if (!viaPortal) {
      var peakOff = t.emitDelay / t.total;
      var holdOff = t.closeStart / t.total;
      entryAnims.push(portal.coverBreath(cover.sleeve, {
        from: 0.62, total: t.total, peakOff: peakOff, holdOff: holdOff, sync: true
      }));
      entryAnims = entryAnims.concat(portal.pulse(
        null, cover.mosaic, t.total, peakOff, holdOff, 1, 1.5,
        0.88, 140 / t.total // breath in before the exhale spits the masthead out
      ));
    }

    // Spit the masthead siblings out from the cover's centre, clearing their pre-deal
    // hide (they were set opacity:0 before paint) as the deal reveals them.
    entryAnims = entryAnims.concat(portal.dealCards(mast, base, rects, t, { clearHide: true }));
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
    // No inhale arg: the gather is itself an inhale (a plain exhale-free pulse).
    flyAnims = portal.pulse(cover.sleeve, cover.mosaic, total, 0.6, 0.85, 0.97, 1.18);

    var pending = cards.length;
    function settle() {
      if (--pending > 0) return;
      done();
    }

    cards.forEach(function (card, i) {
      var r = card.getBoundingClientRect();
      // Shrink to a tile at the cover's centre (same born-size as the deal) as it
      // fades — the mirror of a card being born from the vortex.
      var t = "translate(" + (base.left - r.left) + "px, " + (base.top - r.top) + "px) scale(" + portal.bornScale + ")";
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
      NOTE_NUM,
      { setAbbr: "NWS", author: "Atelier Kashinoga" } // match the static masthead siblings (WX 001 / WX 003)
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
      setForecast(forecastBody(forecast.place, forecast.period, forecast.generatedAt));
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
      generatedAt: "2026-06-29T11:35:00-05:00",
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
  // the last-shown reading at the new limit so the change is visible at once. Its
  // elements live on the dev Deck card (setupDevCards, ?dev), built below — assigned
  // there. Null in the normal app, where the reveal limit holds at its default;
  // syncStepper/stepReveal guard on null.
  var countEl = null, lessBtn = null, moreBtn = null;

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
  // The Cached Iowa button + reveal stepper live on the dev Deck card now (?dev).
  // The forecast card's idle state is set in place (no deal, so no rect read) —
  // render it straight away; the alerts region starts empty.
  renderEmpty();

  // ── Dev cards (opt-in via ?dev) ───────────────────────────────────────────
  // All developer affordances, off the product cards and onto their own dev row:
  //   • Weather — a condition picker + temperature slider drive forecastBody in
  //     place (no deal) so every condition/temp combo's mosaic palette previews at
  //     a scrub, with the resolved palette named on the card.
  //   • Deck — the Cached Iowa fixture (a full deal: forecast + alerts) and the
  //     reveal stepper (how many result cards are dealt).
  // Each is inserted into the masthead section just before #wx-results, so it flows
  // in the masthead row (after the static cards / forecast) and always sits above
  // the dealt results — reachable no matter how many result cards are revealed.
  // mastCards() excludes data-wx-slot "dev-*", so the entry deal and pre-deal hide
  // leave them alone. Built only when the URL carries ?dev (or #dev).
  function devCardEl(slot, inner) {
    var tmp = document.createElement("div");
    tmp.innerHTML = sleeve(inner, false); // no row-start: flow with the mast cards
    var el = tmp.firstChild;
    el.setAttribute("data-wx-slot", slot);
    var cover = coverParts();
    var mast = cover.sleeve ? cover.sleeve.parentNode : null;
    var results = document.getElementById("wx-results");
    if (mast && results) mast.insertBefore(el, results);
    else if (mast) mast.appendChild(el);
    else (document.querySelector("main") || document.body).appendChild(el);
    return el;
  }

  function setupDevCards() {
    // Weather card — palette preview.
    var DEV_CONDS = [
      "Sunny", "Clear", "Mostly Cloudy", "Patchy Fog", "Chance Light Rain",
      "Rain Showers", "Scattered Thunderstorms", "Snow Likely", "Freezing Rain", "Blizzard"
    ];
    var opts = DEV_CONDS.map(function (c) {
      return '<option value="' + esc(c) + '">' + esc(c) + "</option>";
    }).join("");
    devCardEl("dev-weather",
      title("Weather", "var(--orange)") +
      typeRow("Developer — Palette Preview", "ph-cloud-sun") +
      '<div class="card-text-box">' +
        '<div class="select-field"><span class="field-label">Condition</span>' +
          '<div class="select"><select id="wx-dev-cond" aria-label="Condition">' + opts + "</select>" +
            '<i class="select-chevron ph ph-caret-down"></i></div></div>' +
        '<div class="select-field"><span class="field-label">Temperature · ' +
          '<span id="wx-dev-temp-val">72°F</span></span>' +
          '<input type="range" id="wx-dev-temp" class="wx-dev-range" min="-20" max="120" step="1" value="72" aria-label="Temperature (°F)"></div>' +
        '<p class="card-quote">Palette · <span id="wx-dev-pal">—</span></p>' +
      "</div>" +
      footer("WX DEV", "WEATHER")
    );

    // Deck card — fixture + reveal stepper.
    devCardEl("dev-deck",
      title("Deck", "var(--orange)") +
      typeRow("Developer — Deal & Reveal", "ph-flask") +
      '<div class="card-text-box">' +
        "<p>Deal the cached Iowa fixture, and set how many result cards are revealed.</p>" +
        '<div class="btn-group">' +
          '<button class="btn btn--ghost btn--sm" id="wx-cached"><i class="ph ph-flask"></i>Cached Iowa</button>' +
          '<div class="wx-stepper" role="group" aria-label="Cards to reveal">' +
            '<button class="btn btn--outline btn--sm wx-stepper-btn" id="wx-reveal-less" aria-label="Reveal fewer cards"><i class="ph ph-minus"></i></button>' +
            '<span class="wx-stepper-value" id="wx-reveal-count" aria-live="polite">' + revealLimit + "</span>" +
            '<button class="btn btn--outline btn--sm wx-stepper-btn" id="wx-reveal-more" aria-label="Reveal more cards"><i class="ph ph-plus"></i></button>' +
          "</div>" +
        "</div>" +
      "</div>" +
      footer("WX DEV", "DECK")
    );

    // Wire the Weather card: condition + temperature drive the forecast palette.
    var condEl = document.getElementById("wx-dev-cond");
    var tempEl = document.getElementById("wx-dev-temp");
    var tempVal = document.getElementById("wx-dev-temp-val");
    var palVal = document.getElementById("wx-dev-pal");
    var raf = 0;
    function devPeriod() {
      var t = parseFloat(tempEl.value);
      return {
        name: "Dev Preview", temperature: t, temperatureUnit: "F",
        shortForecast: condEl.value,
        detailedForecast: condEl.value + " — developer preview at " + t + "°F."
      };
    }
    function devRender() {
      raf = 0;
      setForecast(forecastBody("Dev Preview", devPeriod(), new Date().toISOString()));
    }
    function devTick() {
      var p = devPeriod();
      tempVal.textContent = p.temperature + "°F";
      palVal.textContent = forecastPalette(p);
      if (!raf) raf = requestAnimationFrame(devRender); // coalesce a scrub to 1 build/frame
    }
    condEl.addEventListener("change", devTick);
    tempEl.addEventListener("input", devTick);
    devTick(); // initial preview

    // Wire the Deck card: cached fixture + reveal stepper. Assign the module-scoped
    // stepper elements now that they exist, then sync their initial state.
    var cachedBtn = document.getElementById("wx-cached");
    if (cachedBtn) cachedBtn.addEventListener("click", loadCached);
    countEl = document.getElementById("wx-reveal-count");
    lessBtn = document.getElementById("wx-reveal-less");
    moreBtn = document.getElementById("wx-reveal-more");
    if (lessBtn) lessBtn.addEventListener("click", function () { stepReveal(-1); });
    if (moreBtn) moreBtn.addEventListener("click", function () { stepReveal(1); });
    syncStepper();
  }
  var devOn = false;
  try { devOn = new URLSearchParams(location.search).has("dev") || location.hash.slice(1) === "dev"; } catch (e) {}
  if (devOn) setupDevCards();

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
