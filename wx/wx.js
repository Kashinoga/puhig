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

  // A note sleeve carries the app's calm empty / loading / clear / error voice.
  function noteCard(icon, heading, body, rowStart) {
    return sleeve(
      title("Weather", "var(--teal)") +
      typeRow("Reading", icon) +
      '<div class="card-text-box">' +
        '<p class="wx-note-title">' + esc(heading) + "</p>" +
        (body ? "<p>" + esc(body) + "</p>" : "") +
      "</div>" +
      '<div class="card-footer"><div class="card-footer-left">' +
        '<span class="card-number">NWS</span>' +
        '<div class="card-metadata"><span class="card-language">EN</span></div>' +
      "</div></div>",
      rowStart
    );
  }

  function forecastCard(place, period, rowStart) {
    var wind = period.windSpeed ? period.windDirection + " " + period.windSpeed : "";
    return sleeve(
      title(place, "var(--teal)") +
      typeRow("Forecast — " + period.name, "ph-cloud-sun") +
      '<div class="card-text-box">' +
        '<div class="wx-temp"><span class="wx-temp-value">' + esc(period.temperature) + "</span>" +
          '<span class="wx-temp-unit">°' + esc(period.temperatureUnit) + "</span></div>" +
        '<p class="wx-short">' + esc(period.shortForecast) + "</p>" +
        "<p>" + esc(trunc(period.detailedForecast, 130)) + "</p>" +
      "</div>" +
      '<div class="card-footer"><div class="card-footer-left">' +
        '<span class="card-number">NWS</span>' +
        '<div class="card-metadata"><span class="card-language">' + esc(wind) + "</span></div>" +
      "</div></div>",
      rowStart
    );
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
      '<div class="card-footer"><div class="card-footer-left">' +
        '<span class="card-number">' + esc(fmtTime(p.effective)) + "</span>" +
        '<div class="card-metadata"><span class="card-language">until ' + esc(fmtTime(p.expires)) + "</span></div>" +
      "</div></div>",
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
  // Forecast + alerts share one results region (row 2 onward); the first card
  // starts the new row beneath the cover / about / location row.

  function render(html) {
    resultsEl.innerHTML = html;
  }

  // Deal animation: after a selection, the result cards are drawn out from under
  // the WX cover (the deck) one at a time, fanning straight to its right (the
  // cover stays on top, so they read as slid out from beneath it), while the
  // static row-1 cards (about + location) nudge aside to make room. The fan
  // shows at most four — a fifth-and-beyond pile sits under the fourth card,
  // all at full opacity. After a brief hold the cards fly to their grid slots
  // back-to-front (the back of the fan first, the top card last).
  // FLIP-style: the cards already occupy their final slots, so only transform +
  // opacity animate (no reflow); the static cards' nudge returns to rest.
  // Skipped under prefers-reduced-motion.
  var reduceMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");

  function dealIn() {
    if (reduceMotionMQ.matches) return;
    var cards = Array.prototype.slice.call(resultsEl.querySelectorAll(":scope > .card-sleeve"));
    if (!cards.length) return;

    // Cancel any still-running prior deal (e.g. a rapid re-click) so its
    // late-firing onfinish — which runs on the now-detached old cards — can't
    // clear the cover's z-index that this new deal is about to set.
    for (var k = 0; k < dealAnims.length; k++) { try { dealAnims[k].cancel(); } catch (e) {} }
    dealAnims = [];

    // The cover card is the deck: cards are dealt from its slot. Fall back to the
    // first result slot if the cover can't be found (defensive).
    var coverFrame = document.querySelector('[data-row="wx"] .card-frame--cover');
    var coverSleeve = coverFrame ? coverFrame.closest(".card-sleeve") : null;

    // Read every final rect first (one layout pass), then animate transforms.
    var rects = cards.map(function (c) { return c.getBoundingClientRect(); });
    var base = coverSleeve ? coverSleeve.getBoundingClientRect() : rects[0];

    // One shared timeline of absolute times, mapped to per-card keyframe offsets.
    // Cards emerge one at a time (staggered forward), the fan caps at four (the
    // fourth-and-beyond share one slot), all hold, then they fly to their
    // slots back-to-front (highest index first).
    var lastIdx = cards.length - 1;
    var emergeStep = 125; // gap between successive cards sliding out
    var emergeDur = 340;  // one card's slide-out
    var holdDur = 280;    // the pause once the fan is laid out
    var flyStep = 135;    // gap between successive cards flying off
    var flyDur = 480;     // one card's flight to its slot
    var maxFanIdx = 3;    // fan positions 0..3; index >= 3 share slot 3
    var peek = 50;        // px of each card shown past the one in front (its right edge / pips)
    var slide = 30;       // px the cover eases left during the reveal, opening room

    var lastEmergeIdx = Math.min(lastIdx, maxFanIdx);
    var flyPhaseStart = lastEmergeIdx * emergeStep + emergeDur + holdDur;
    var total = flyPhaseStart + lastIdx * flyStep + flyDur;

    // Nudge the static row-1 cards (everything to the cover's right: the about +
    // location cards) aside while the fan lays out, hold, then ease back as the
    // cards fly off to their slots.
    var outer = resultsEl.parentElement;
    var rightSiblings = Array.prototype.slice.call(outer.children).filter(function (el) {
      return el.classList && el.classList.contains("card-sleeve") && el !== coverSleeve;
    });
    // The animation easing is linear so each keyframe's `offset` lands at its
    // intended time; the moving segments carry their own easing (a keyframe's
    // easing applies from it to the next), while the holds stay linear.
    var EASE = "cubic-bezier(0.2, 0.7, 0.25, 1)";

    var pushPx = 56;
    var fanLaidOut = (lastEmergeIdx * emergeStep + emergeDur) / total;
    rightSiblings.forEach(function (s) {
      dealAnims.push(s.animate(
        [
          { transform: "none", offset: 0, easing: "ease-in-out" },
          { transform: "translateX(" + pushPx + "px)", offset: fanLaidOut },
          { transform: "translateX(" + pushPx + "px)", offset: flyPhaseStart / total, easing: "ease-in-out" },
          { transform: "none", offset: 1 }
        ],
        { duration: total, easing: "linear" }
      ));
    });

    // Keep the cover above the emerging cards so they slide out from beneath it,
    // and ease it slightly left through the reveal to open room for the fan,
    // settling back as the cards fly off.
    if (coverSleeve) {
      coverSleeve.style.zIndex = "200";
      dealAnims.push(coverSleeve.animate(
        [
          { transform: "none", offset: 0, easing: "ease-in-out" },
          { transform: "translateX(-" + slide + "px)", offset: fanLaidOut },
          { transform: "translateX(-" + slide + "px)", offset: flyPhaseStart / total, easing: "ease-in-out" },
          { transform: "none", offset: 1 }
        ],
        { duration: total, easing: "linear" }
      ));
    }

    cards.forEach(function (card, i) {
      var r = rects[i];
      var fanIdx = Math.min(i, maxFanIdx);
      var coverDX = base.left - r.left;
      var coverDY = base.top - r.top;
      // Fan straight out to the cover's right (x-axis only); held at the cover's
      // own vertical band, behind it, so the cards read as drawn from under it.
      // Each shows only `peek` past the one in front — its right edge and pips.
      // Measured from the cover's slid-left position so the peeks stay uniform.
      var emergeLeft = (base.left - slide) + peek * (fanIdx + 1);
      var emergeTop = base.top;
      var emDX = emergeLeft - r.left;
      var emDY = emergeTop - r.top;

      var emergeStart = fanIdx * emergeStep;
      var emergeEnd = emergeStart + emergeDur;
      var flyStart = flyPhaseStart + (lastIdx - i) * flyStep; // back of fan flies first
      var flyEnd = flyStart + flyDur;

      // Full size throughout — the revealed cards match the cover, never shrunk.
      var coverT = "translate(" + coverDX + "px, " + coverDY + "px)";
      var fanT = "translate(" + emDX + "px, " + emDY + "px)";
      var fanOpacity = 1;

      // offset 0 → (hold on cover) → emerge to fan → (hold) → fly to slot → (hold)
      var frames = [];
      if (emergeStart > 0) {
        frames.push({ transform: coverT, opacity: 0, offset: 0 });
        frames.push({ transform: coverT, opacity: 0, offset: emergeStart / total, easing: EASE });
      } else {
        frames.push({ transform: coverT, opacity: 0, offset: 0, easing: EASE });
      }
      frames.push({ transform: fanT, opacity: fanOpacity, offset: emergeEnd / total });
      frames.push({ transform: fanT, opacity: fanOpacity, offset: flyStart / total, easing: EASE });
      frames.push({ transform: "none", opacity: 1, offset: flyEnd / total });
      if (flyEnd < total) frames.push({ transform: "none", opacity: 1, offset: 1 });

      card.style.zIndex = String(100 - i); // first card out sits in front; the back of the fan sits behind
      var anim = card.animate(frames, { duration: total, easing: "linear" });
      dealAnims.push(anim);
      anim.onfinish = function () {
        card.style.zIndex = "";
        if (i === 0 && coverSleeve) coverSleeve.style.zIndex = ""; // front card lands last
      };
    });
  }

  function renderEmpty() {
    render(noteCard(
      "ph-compass",
      "The sky, unread.",
      "Choose a state to draw its current forecast and any active weather alerts.",
      true
    ));
  }

  // Render the forecast + alerts (or the appropriate note) and deal them in.
  // Shared by the live fetch and the cached test fixture.
  function showResults(stateName, forecast, alerts) {
    lastShown = { stateName: stateName, forecast: forecast, alerts: alerts };

    if (!forecast && !alerts) {
      render(noteCard(
        "ph-cloud-slash",
        "The signal didn't reach us.",
        "The National Weather Service couldn't be read just now. Try again in a moment.",
        true
      ));
      return;
    }

    // Cap the deal at the stepper's reveal limit (forecast counts as one card).
    var cards = [];
    if (forecast && forecast.period) {
      cards.push(forecastCard(forecast.place, forecast.period, true));
    }

    if (alerts && alerts.length) {
      currentAlerts = alerts;
      for (var i = 0; i < alerts.length && cards.length < revealLimit; i++) {
        cards.push(alertCard(alerts[i], i, cards.length === 0));
      }
    } else if (alerts) {
      cards.push(noteCard("ph-sun", "Clear skies.", "No active alerts for " + stateName + ".", cards.length === 0));
    }

    render(cards.join(""));
    dealIn();
  }

  function onSelect() {
    var state = stateByAbbr(selectEl.value);
    if (!state) { renderEmpty(); return; }

    var token = ++requestId;
    currentAlerts = [];
    render(noteCard("ph-cloud", "Reading the sky over " + state.capital + "…", null, true));

    Promise.all([
      loadForecast(state).catch(function () { return null; }),
      loadAlerts(state).catch(function () { return null; })
    ]).then(function (out) {
      if (token !== requestId) return; // a newer selection has taken over
      showResults(state.name, out[0], out[1]);
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
    requestId++;                 // cancel any in-flight live fetch
    currentAlerts = [];
    showResults("Iowa", CACHED_IOWA.forecast, CACHED_IOWA.alerts);
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
  renderEmpty();
})();
