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

  // The postal abbreviation for a state's display name (e.g. "Iowa" → "IA") —
  // the area code shown on the alert card footers.
  function abbrByName(name) {
    for (var i = 0; i < STATES.length; i++) {
      if (STATES[i].name === name) return STATES[i].abbr;
    }
    return "";
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

  // The forecast lives in a fixed masthead card (WX 003, col 4): its body is
  // swapped in place — never dealt — through noteBody / forecastBody below. The
  // dealt cards (alerts, the clear-skies note) wrap a body in a sleeve instead.
  var FC_NUM = "WX 003"; // the forecast card's collector number / its column
  var STA_NUM = "WX 004"; // the station card's collector number / its column (5)

  // Every card is designed by Atelier Kashinoga for now, so the author defaults
  // to it and pairs with the language in every footer's bottom-right.
  var DESIGNER = "Atelier Kashinoga";

  // A footer, mirroring the static masthead cards' four-section layout — number
  // top-left, set abbreviation bottom-left, an optional version top-right, and
  // the language + author bottom-right. opts.setAbbr renders a set abbreviation
  // (the data source, e.g. "NWS") in the bottom-left; opts.author overrides the
  // default designer, paired with the language via .card-credit (dot-separated).
  function footer(number, meta, opts) {
    opts = opts || {};
    var author = opts.author || DESIGNER;
    var left =
      '<span class="card-number">' + esc(number) + "</span>" +
      (opts.setAbbr
        ? '<div class="card-metadata"><span class="card-set-abbreviation">' +
            esc(opts.setAbbr) + "</span></div>"
        : "");
    var lang = '<span class="card-language">' + esc(meta) + "</span>";
    var right =
      '<div class="card-credit">' + lang +
        '<span class="card-author">' + esc(author) + "</span></div>";
    return (
      '<div class="card-footer">' +
        '<div class="card-footer-left">' + left + "</div>" +
        '<div class="card-footer-right">' + right + "</div>" +
      "</div>"
    );
  }

  // A note body carries the app's calm empty / loading / clear / error voice.
  // opts (optional): opts.label overrides the type-row label (default "Reading",
  // e.g. "No Alerts" for the clear-skies card); the rest flows to footer — a
  // caller can pass the set abbreviation + author to match the masthead siblings.
  function noteBody(icon, heading, body, number, opts) {
    opts = opts || {};
    return (
      title("Weather", "var(--teal)") +
      typeRow(opts.label || "Reading", icon) +
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
    // alert cards' times. It rides the bottom of the description box as a dim italic
    // card-quote — the deck's aside voice — rather than the footer meta.
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
        (at ? '<p class="card-quote">Forecasted at ' + esc(at) + "</p>" : "") +
      "</div>" +
      footer(FC_NUM, "EN", { setAbbr: "NWS" })
    );
  }

  // The station card (WX 004, col 5): the forecast's source, on its own masthead
  // card beside the forecast. Its identifier (e.g. "KDSM") heads the card and the
  // friendly name sits in the box. When no station resolved, a calm fallback names
  // the bare data source (NWS) in the app's empty/error voice.
  function stationBody(station) {
    if (!station || !station.id) {
      return (
        title("Station", "var(--teal)") +
        typeRow("Source — NWS", "ph-broadcast") +
        '<div class="card-text-box">' +
          '<p class="wx-note-title">Nearest station unavailable.</p>' +
          "<p>Source: the U.S. National Weather Service.</p>" +
        "</div>" +
        footer(STA_NUM, "EN", { setAbbr: "NWS" })
      );
    }
    return (
      title(station.id, "var(--teal)") +
      typeRow("Station — Observation", "ph-broadcast") +
      '<div class="card-text-box">' +
        '<p class="wx-note-title">' + esc(station.name || station.id) + "</p>" +
        '<p class="card-quote">Nearest observation station</p>' +
      "</div>" +
      footer(STA_NUM, "EN", { setAbbr: "NWS" })
    );
  }

  // A dealt note sleeve (the "clear skies" / no-alerts card), numbered as a data
  // note (NWS) since it sits in the alerts region, not the masthead.
  function noteCard(icon, heading, body, rowStart, label) {
    return sleeve(noteBody(icon, heading, body, "NWS", { label: label }), rowStart);
  }

  // The alert's body beats, below the 📍 strip: the effect window as dim meta (the
  // duration that used to sit in the footer), then the headline. Each renders as a
  // paragraph; the short window stays whole on the first card, the headline splits
  // across cards after it.
  function alertBodyBeats(p) {
    var beats = [];
    var eff = fmtTime(p.effective), exp = fmtTime(p.expires);
    var when = eff && exp ? eff + " → " + exp : exp ? "Until " + exp : eff ? "From " + eff : "";
    if (when) beats.push({ text: when, cls: "wx-alert-when" });
    var headline = headlineOf(p);
    if (headline) beats.push({ text: headline, cls: "" });
    return beats;
  }

  // Card-body pagination is a framework toolkit now (window.puhig.paginate, from
  // puhig.js, loaded first) so any deck card can split long prose across card-sized
  // pages — not just WX. WX supplies the alert beats (alertBodyBeats) and the card
  // shell (alertPageCard); the toolkit measures real fit at the live card width and
  // returns one body-HTML string per card. The 📍 strip is the first card's lead
  // element (its room reserved via availH1); continuation cards drop it (availHn).
  var paginateBody = window.puhig.paginate.paginate;

  // Build one alert card. `pageCount > 1` shows a "(p/N)" tally in the title so a
  // reader sees a split alert continues; `bodyHtml` is this page's body paragraphs
  // (a slice of the headline, plus the effect window on the page it lands). `index`
  // is the alert's index in currentAlerts (shared across pages) — every page's Copy
  // yields the whole alert. `areaCode` is the state's postal code (e.g. "IA"), the
  // footer number; the source (NWS) is now its own masthead card (stationBody).
  function alertPageCard(p, index, bodyHtml, pageIdx, pageCount, rowStart, areaCode) {
    var tally = pageCount > 1 ? " (" + (pageIdx + 1) + "/" + pageCount + ")" : "";
    // The 📍 location strip heads only the first card; continuation cards (2/N onward)
    // drop it — the area is already established — so their prose fills the whole body.
    // The area line sits over a green mosaic sized to the text: a left-aligned static
    // strip (data-mosaic-static — no press/drift/stagger) whose host takes its height
    // from the 📍 line, so fitMosaics cuts tiles to the text's height. A full mosaic
    // (no data-mosaic-type="ca") — every cell a solid tile, so at only a few rows tall
    // no CA dead cells bare the dark mosaic-bg.
    var area = pageIdx > 0 ? "" :
      '<div class="wx-area-art" data-target="16" data-mosaic-align="left" data-mosaic-palette="green" data-mosaic-static>' +
        '<div class="mosaic-overlay"></div>' +
        '<p class="wx-area">📍 ' + esc(trunc(p.areaDesc || "", 80)) + "</p>" +
      "</div>";
    return sleeve(
      title((p.event || "Alert") + tally, "var(--orange)") +
      typeRow("Alert — " + (p.severity || "Unknown"), "ph-warning") +
      '<div class="card-text-box">' +
        area +
        bodyHtml +
        '<div class="card-stat">' +
          '<button class="btn btn--outline btn--sm" data-copy="' + index + '"><i class="ph ph-copy"></i>Copy</button>' +
        "</div>" +
      "</div>" +
      footer(areaCode || "NWS", "EN", { setAbbr: "NWS" }),
      rowStart
    );
  }

  // ---- data ----------------------------------------------------------------

  // A tiny persistent response cache over NWS. It exists to be a good API
  // citizen: the point → gridpoint mapping and its station list are keyed by a
  // state's fixed capital coordinates and never change, yet a naive app re-fetches
  // them on every selection. NWS answers each response with a Cache-Control
  // lifetime (points ~21h, a forecast ~22min); we honour that — serving a cached
  // body while it is still fresh instead of hitting the network — with a long
  // floor on the two static hops (they outlive any single max-age) and a short
  // ceiling on the volatile ones (alerts). A stale entry is kept as a fallback so
  // a transient NWS failure shows the last good reading rather than the error card.
  // The cache — a { url: entry } map — persists under the shared store's "wx" area
  // (window.puhig.store, from puhig.js), so it shares the framework's versioned
  // namespace with WX's saved state and the HIG prefs rather than owning a loose key.
  var wxStore = window.puhig.store.area("wx");

  function cacheAll() {
    var all = wxStore.getJSON("cache", {});
    return all && typeof all === "object" ? all : {};
  }
  function cacheGet(url) {
    var e = cacheAll()[url];
    return e && typeof e === "object" ? e : null;
  }
  function cacheSet(url, entry) {
    var all = cacheAll();
    all[url] = entry;
    wxStore.setJSON("cache", all);
  }

  // The freshness window for a response, in ms: NWS's own Cache-Control max-age
  // (falling back to Expires, then `fallback` seconds), clamped to [floor, ceil]
  // so the static hops persist past a single max-age and the volatile ones can't
  // be pinned stale by a long server lifetime.
  function freshMs(res, opts) {
    var sec = null;
    var cc = res.headers.get("cache-control") || "";
    var m = /max-age\s*=\s*(\d+)/i.exec(cc);
    if (m) sec = parseInt(m[1], 10);
    if (sec == null) {
      var exp = Date.parse(res.headers.get("expires") || "");
      if (!isNaN(exp)) sec = Math.max(0, (exp - Date.now()) / 1000);
    }
    if (sec == null) sec = opts.fallback;
    sec = Math.max(opts.floor, Math.min(opts.ceil, sec));
    return sec * 1000;
  }

  // Fetch JSON through the cache. Within an entry's freshness window it resolves
  // from localStorage with no network call at all; past it, it re-fetches and
  // re-stamps. `opts` (floor/ceil/fallback seconds) tunes the window per feed;
  // omit for the default short window. On a network/HTTP error a still-present
  // (even expired) cached body is served rather than rejecting.
  function getJSON(url, opts) {
    opts = opts || { floor: 0, ceil: 300, fallback: 60 };
    var hit = cacheGet(url);
    if (hit && hit.exp > Date.now()) return Promise.resolve(hit.data);
    return fetch(url, { headers: { Accept: "application/geo+json" } }).then(function (r) {
      if (!r.ok) {
        if (hit) return hit.data; // serve stale rather than fail
        throw new Error("NWS responded " + r.status);
      }
      return r.json().then(function (data) {
        var props = (data && data.properties) || {};
        cacheSet(url, {
          data: data,
          exp: Date.now() + freshMs(r, opts),
          // updateTime (== Last-Modified) is the true content version — it moves
          // only when NWS re-issues the forecast, unlike generatedAt which changes
          // every response. Stored so a future conditional-fetch layer can gate on it.
          updateTime: props.updateTime || ""
        });
        return data;
      });
    }).catch(function (err) {
      if (hit) return hit.data;
      throw err;
    });
  }

  // Per-feed cache windows. Static hops (points, stations) key off a state's
  // fixed coordinates and never change, so they floor at a week; the forecast
  // tracks NWS's ~hourly re-issue (honour max-age, ~5min–1h); alerts stay near-
  // live (≤2min) so a real warning surfaces quickly.
  var WEEK = 7 * 24 * 3600;
  var TTL_STATIC = { floor: WEEK, ceil: 30 * WEEK, fallback: WEEK };
  var TTL_FORECAST = { floor: 300, ceil: 3600, fallback: 1200 };
  var TTL_ALERTS = { floor: 0, ceil: 120, fallback: 60 };

  // The nearest observation station names the forecast's source — its identifier
  // (e.g. "KORD") and friendly name — on its own masthead card (stationBody). The
  // station list is ordered nearest-first, so features[0] is the closest.
  function nearestStation(data) {
    var f = (data && data.features) || [];
    var p = f[0] && f[0].properties;
    return p ? { id: p.stationIdentifier || "", name: p.name || "" } : null;
  }

  // Forecast is a two-hop lookup: a point resolves to its gridpoint, which
  // carries the forecast URL and a friendly relative-location name. The same
  // point also lists observation stations, so a third hop — run in parallel with
  // the forecast, off the same point — names the nearest one. Best-effort: a
  // station failure resolves to null and never blocks the forecast.
  function loadForecast(state) {
    return getJSON(API + "/points/" + state.lat + "," + state.lon, TTL_STATIC).then(function (pt) {
      var props = pt.properties || {};
      var rel = props.relativeLocation && props.relativeLocation.properties;
      var place = rel ? rel.city + ", " + rel.state : "Near " + state.capital;
      var stationP = props.observationStations
        ? getJSON(props.observationStations, TTL_STATIC).then(nearestStation).catch(function () { return null; })
        : Promise.resolve(null);
      return Promise.all([getJSON(props.forecast, TTL_FORECAST), stationP]).then(function (res) {
        var fcProps = res[0].properties || {};
        var periods = fcProps.periods || [];
        // generatedAt is when NWS produced the forecast — the "forecasted at" time.
        return { place: place, period: periods[0] || null, generatedAt: fcProps.generatedAt || "", station: res[1] };
      });
    });
  }

  function loadAlerts(state) {
    return getJSON(API + "/alerts/active/area/" + state.abbr, TTL_ALERTS).then(function (data) {
      return (data && data.features) || [];
    });
  }

  // ---- render --------------------------------------------------------------
  // The masthead carries one JS-managed card: on selection, a forecast card
  // (WX 003) built in its own host to the right (col 4). Alerts share the results
  // region (row 2 onward); their first card starts that row.

  function render(html) {
    resultsEl.innerHTML = html;
  }

  // A masthead card that lives in its own host to the right (the forecast in col 4,
  // the station in col 5), created on selection and updated in place — no deal
  // animation. The sleeve is built once (so puhig.js's flip-init survives) and only
  // its card-frame body swaps; clear() removes the card entirely (the idle masthead).
  function cardHost(hostId, slot) {
    var host = document.getElementById(hostId);
    var bodyId = hostId + "-body";
    function frame() {
      if (!host) return null;
      var f = host.querySelector("#" + bodyId);
      if (!f) {
        host.innerHTML =
          '<div class="panel-frame card-sleeve" data-row="wx" data-wx-slot="' + slot + '">' +
            '<div class="panel-content card"><div class="card-frame" id="' + bodyId + '" aria-live="polite"></div></div>' +
            '<div class="card-back"><i class="ph ph-planet"></i></div>' +
          "</div>";
        f = host.querySelector("#" + bodyId);
      }
      return f;
    }
    return {
      host: host,
      set: function (body) { var f = frame(); if (f) f.innerHTML = body; },
      clear: function () { if (host) host.innerHTML = ""; }
    };
  }
  var forecastCard = cardHost("wx-forecast", "forecast");
  var stationCard = cardHost("wx-station", "station");

  // Deal animation: the WX cover is a portal. On a selection it cycles open in
  // one continuous beat:
  // (1) The cover's face recedes a touch (a 2D scale on its front, .panel-content)
  //     while the mosaic behind it zooms in — a vortex opening. (The face scale
  //     keeps the no-op rotateY(0) that enrols it in the flip's 3D context.)
  // (2) The dealt cards — the forecast card (WX 003, col 4) leading, then the
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

  // The masthead: the cover's sibling sleeves (About, Location) on
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

  // Every card that rides the portal, in reading order: the forecast card (WX 003,
  // col 4) leads, then the station card (WX 004, col 5), then the alert cards
  // (row 2). All are born from / gathered into the cover.
  function dealableCards() {
    var list = [];
    [forecastCard.host, stationCard.host].forEach(function (host) {
      if (host) list = list.concat(Array.prototype.slice.call(host.querySelectorAll(":scope > .card-sleeve")));
    });
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
  // (001), Location (002) — are spat out from the cover's
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
    // Clear any pre-paint hide (direct load pins the cover invisible until now so it
    // never flashes at rest before this entry). The coverBreath below fades it in
    // from opacity:0; via the portal the cover was never hidden, so this is a no-op.
    cover.sleeve.style.opacity = "";
    var mast = mastCards();
    if (!mast.length) return;

    // When we arrive on a remembered state, its forecast + alert cards were already
    // rendered pre-hidden (restoreState, below) before this entry ran — fold them
    // into the same spit so they're born from the cover alongside the masthead, in
    // reading order (row 1 left→right: About, Location, forecast; then row 2: alerts)
    // rather than dealing separately a beat early. On a normal load there are none.
    var spit = mast.concat(dealableCards());

    var base = cover.sleeve.getBoundingClientRect();
    var rects = spit.map(function (c) { return c.getBoundingClientRect(); });

    // On a direct load the cover enters face-down and turns over before the masthead
    // spits (matching every HIG cover). A lead of flipLead + flipDur is reserved ahead
    // of the emit so the born-flipped grow-in and the turn each read as their own beat,
    // then the vortex opens on the revealed front. Via the cross-document portal the
    // morph IS the front's entry, so no flip and no lead.
    var flipLead = 360, flipDur = 480;
    var lead = viaPortal ? 0 : flipLead + flipDur;
    var t = portal.dealTiming(spit.length, {
      emitDelay: 300 + lead, emitStep: 90, emitDur: 460, settleDur: 160, closeDur: 300
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
      // Turn the cover over: born face-down (rotateY 180, its .card-back showing), held
      // through flipLead while it grows in, then rotated to the front over flipDur with a
      // slight rotateX lift at the half-turn. Targets the .flip-inner puhig.js's initFlip
      // wrapped the sleeve in, so it composes with the breath on the flat sleeve.
      // fill:backwards holds the face-down pose across the lead without leaving an inline
      // transform behind — on finish it reverts to the inner's resting front.
      var inner = cover.sleeve.querySelector(":scope > .flip-inner");
      if (inner) {
        entryAnims.push(inner.animate(
          [
            { transform: "perspective(600px) rotateY(180deg) rotateX(0deg)" },
            { transform: "perspective(600px) rotateY(90deg) rotateX(6deg)", offset: 0.5 },
            { transform: "perspective(600px) rotateY(0deg) rotateX(0deg)" }
          ],
          { duration: flipDur, delay: flipLead, easing: portal.EASE, fill: "backwards" }
        ));
      }
    }

    // Spit the masthead siblings (and any restored result cards) out from the cover's
    // centre, clearing their pre-deal hide (they were set opacity:0 before paint) as
    // the deal reveals them.
    entryAnims = entryAnims.concat(portal.dealCards(spit, base, rects, t, { clearHide: true }));
  }

  // Play the entry exactly once. Prefer pagereveal — it fires before the first
  // paint and tells us (via e.viewTransition) whether the cover portal is morphing
  // us in, and applying the born-at-centre poses there hides the masthead from the
  // portal's snapshot so it deals in cleanly afterwards. Fall back to an immediate
  // run for browsers without cross-document View Transitions (no portal there).
  //
  // Restore coordination: when we arrive on a remembered state we want its cards
  // spat WITH the masthead, in reading order — which needs them rendered (and
  // pre-hidden) before entryDeal reads its spit list. Whether the (usually cached)
  // restore resolves before the entry's pagereveal/load fires is a race we must not
  // depend on — losing it dealt the results early / separately. So while a restore
  // is still pending (awaitingRestore && !restoreReady) the entry doesn't play; it
  // parks its viaPortal in pendingEntry, and whichever of restoreState (data ready)
  // or the backstop timeout resolves first flushes it. A normal load (no saved
  // state) never sets awaitingRestore, so it plays immediately as before.
  var entryPlayed = false;
  var awaitingRestore = false; // a saved state is being restored before the entry
  var restoreReady = false;    // the restore has rendered its (pre-hidden) cards
  var pendingEntry = null;     // a parked entry waiting on the restore: { viaPortal }

  function playEntry(viaPortal) {
    if (entryPlayed) return;
    if (awaitingRestore && !restoreReady) { pendingEntry = { viaPortal: viaPortal }; return; }
    entryPlayed = true;
    entryDeal(viaPortal);
  }

  // Play a parked entry (restore is ready, or the backstop gave up waiting).
  function flushPendingEntry() {
    if (entryPlayed || !pendingEntry) return;
    var vp = pendingEntry.viaPortal;
    pendingEntry = null;
    entryPlayed = true;
    entryDeal(vp);
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

  // The idle masthead: the forecast + station cards and the alerts region are
  // cleared. Used on load and the placeholder re-select.
  function renderEmpty() {
    forecastCard.clear();
    stationCard.clear();
    render("");
  }

  // Build the forecast card's body and the alert cards (+ a clear-skies note when
  // there are none) into the DOM — but do NOT animate. Returns nothing; the caller
  // decides how the cards enter (a fresh deal, or riding the page-load entry spit).
  // Shared by the live fetch, the cached fixture, and the remembered-state restore.
  function renderResults(stateName, forecast, alerts) {
    lastShown = { stateName: stateName, forecast: forecast, alerts: alerts };

    if (forecast && forecast.period) {
      forecastCard.set(forecastBody(forecast.place, forecast.period, forecast.generatedAt));
    } else if (!forecast && !alerts) {
      // Both feeds failed: the forecast card carries the error (and deals in too).
      forecastCard.set(noteBody(
        "ph-cloud-slash",
        "The signal didn't reach us.",
        "The National Weather Service couldn't be read just now. Try again in a moment.",
        FC_NUM,
        { setAbbr: "NWS" }
      ));
    } else {
      // Alerts came through but no forecast — note it on the card.
      forecastCard.set(noteBody("ph-cloud-slash", "Forecast unavailable.", "No current forecast for " + stateName + ".", FC_NUM, { setAbbr: "NWS" }));
    }

    // The forecast's source, on its own masthead card beside it (col 5): the
    // nearest observation station, or a calm fallback naming NWS when none resolved.
    stationCard.set(stationBody((forecast && forecast.station) || null));

    // Cap the alert deal at the stepper's reveal limit.
    var cards = [];
    var areaCode = abbrByName(stateName); // the alert footers' area code (e.g. "IA")
    if (alerts && alerts.length) {
      currentAlerts = alerts;
      // A live alert's headline can overrun one fixed-height card, so long alerts
      // split across several (paginateBody). Fit is measured at the live card size —
      // the body text is cqi-sized to the .card-frame — so probe-render the alerts
      // (full headline), then read each card's frame width and the space its body
      // paragraph gets (the 📍 strip's height varies with the area text, per alert).
      var probe = [];
      for (var i = 0; i < alerts.length && probe.length < revealLimit; i++) {
        var pp0 = alerts[i].properties || {};
        probe.push(alertPageCard(pp0, i, paginateBody(alertBodyBeats(pp0))[0], 0, 1, probe.length === 0, areaCode));
      }
      render(probe.join(""));
      var probeCards = resultsEl.querySelectorAll(".card-sleeve");
      var frame = resultsEl.querySelector(".card-frame");
      var frameW = frame ? frame.getBoundingClientRect().width : 0; // border-box, matches the measurer
      if (frameW) {
        for (var a = 0; a < probe.length && cards.length < revealLimit; a++) {
          var pp = alerts[a].properties || {};
          // Two body heights: the first card's body runs from just below the 📍 strip
          // to the Copy corner (availH1); a continuation card drops the strip, so its
          // body runs from the text box's top instead (availHn, taller). The 📍 strip's
          // height varies with the area text, so both are read per alert.
          var tb = probeCards[a].querySelector(".card-text-box");
          var bodyP = tb.querySelector(":scope > p");
          var copyBtn = probeCards[a].querySelector(".card-stat");
          var availH1 = 0, availHn = 0;
          if (tb && bodyP && copyBtn) {
            var cs = getComputedStyle(tb), tbRect = tb.getBoundingClientRect();
            var tbTop = tbRect.top + parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth);
            var copyTop = copyBtn.getBoundingClientRect().top;
            availH1 = copyTop - bodyP.getBoundingClientRect().top - 4;
            availHn = copyTop - tbTop - 4;
          }
          var pages = paginateBody(alertBodyBeats(pp), availH1, availHn, frameW);
          for (var pi = 0; pi < pages.length && cards.length < revealLimit; pi++) {
            cards.push(alertPageCard(pp, a, pages[pi], pi, pages.length, cards.length === 0, areaCode));
          }
        }
      } else {
        cards = probe; // no card to measure — deal the unpaginated probe
      }
    } else if (alerts) {
      cards.push(noteCard("ph-sun", "Clear skies.", "No active alerts for " + stateName + ".", true, "No Alerts"));
    }

    render(cards.join(""));
  }

  // Render the reading, then deal the forecast card (col 4) + any alerts (row 2)
  // in from the portal. The normal path for a live pick and the cached fixture.
  function showResults(stateName, forecast, alerts) {
    renderResults(stateName, forecast, alerts);
    dealIn();
  }

  function onSelect() {
    var state = stateByAbbr(selectEl.value);
    // Remember the choice so the next visit reopens on it; the placeholder clears
    // it. Saved under the shared store's "wx" area (alongside the response cache).
    if (state) wxStore.set("state", state.abbr);
    else wxStore.del("state");
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

  // Reopen on a remembered state at page load. Unlike onSelect this doesn't gather
  // (nothing is shown yet) and doesn't deal on its own — it renders the reading and
  // hands off to the entry so the forecast + alerts are spat out of the cover
  // alongside the masthead, in one reading-order beat. The entry parks itself while
  // this is pending (see playEntry), so the outcome doesn't depend on whether the
  // fetch beats pagereveal/load:
  //   • entry not yet played → pre-hide the result cards and flush the parked entry;
  //     entryDeal folds them into its spit (see dealableCards there).
  //   • entry already played (the backstop released it, or a genuinely slow restore
  //     that timed out) → deal them in on their own, like a live pick's late arrival.
  // Under reduced motion nothing animates — render at rest and just release the entry.
  function restoreState(state) {
    var token = ++requestId;
    currentAlerts = [];
    Promise.all([
      loadForecast(state).catch(function () { return null; }),
      loadAlerts(state).catch(function () { return null; })
    ]).then(function (out) {
      if (token !== requestId) return; // a live pick has superseded the restore
      renderResults(state.name, out[0], out[1]);
      restoreReady = true;
      if (reduceMotionMQ.matches) { flushPendingEntry(); return; }
      if (entryPlayed) { dealIn(); return; }
      dealableCards().forEach(function (c) { c.style.opacity = "0"; });
      flushPendingEntry(); // the entry was waiting on us — play it now, results included
    });
  }

  // A frozen NWS fixture (Iowa) for testing the render + deal animation without
  // hitting the API. Shapes mirror loadForecast()/loadAlerts() exactly.
  var CACHED_IOWA = {
    forecast: {
      place: "Des Moines, IA",
      generatedAt: "2026-06-29T11:35:00-05:00",
      station: { id: "KDSM", name: "Des Moines International Airport" },
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

  // A fixture whose lead alert carries an over-long headline that overruns one card,
  // so the dev Pagination card can preview the multi-card split (paginateBody). The
  // short second alert shows the single-card case alongside it.
  var CACHED_LONG = {
    forecast: CACHED_IOWA.forecast,
    alerts: [
      { properties: {
        event: "Winter Storm Warning", severity: "Severe",
        areaDesc: "Polk, IA; Story, IA; Boone, IA; Dallas, IA; Jasper, IA; Marshall, IA",
        parameters: { NWSheadline: ["WINTER STORM WARNING REMAINS IN EFFECT FROM 6 PM THIS EVENING TO NOON CST SATURDAY FOR HEAVY SNOW AND BLOWING SNOW ACROSS CENTRAL IOWA, WITH TOTAL SNOW ACCUMULATIONS OF 8 TO 12 INCHES AND WINDS GUSTING AS HIGH AS 45 MPH EXPECTED TO PRODUCE NEAR-ZERO VISIBILITY AND WIDESPREAD DRIFTING ON AREA ROADS THROUGH THE WEEKEND"] },
        effective: "2026-06-29T18:00:00-05:00", expires: "2026-06-30T12:00:00-05:00"
      } },
      { properties: {
        event: "Wind Advisory", severity: "Moderate",
        areaDesc: "Polk, IA; Warren, IA",
        parameters: { NWSheadline: ["WIND ADVISORY IN EFFECT UNTIL 9 PM CDT"] },
        effective: "2026-06-29T14:00:00-05:00", expires: "2026-06-29T21:00:00-05:00"
      } }
    ]
  };

  // Deal a frozen fixture (no live fetch): reflect Iowa in the picker, cancel any
  // in-flight fetch, gather the old cards, then show the fixture's forecast + alerts.
  function dealFixture(fixture) {
    selectEl.value = "IA";       // reflect the fixture in the dropdown
    var token = ++requestId;     // cancel any in-flight live fetch
    currentAlerts = [];
    clearThen(function () {      // gather old alerts, then show the fixture
      if (token === requestId) showResults("Iowa", fixture.forecast, fixture.alerts);
    });
  }
  function loadCached() { dealFixture(CACHED_IOWA); }

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

  // Reopen on the last-selected state, if one was remembered: reflect it in the
  // picker and kick off restoreState, which renders the reading and hands off to the
  // page-load entry so its forecast + alerts are spat out of the cover together with
  // the masthead, in one reading-order beat (see restoreState / playEntry / entryDeal).
  // awaitingRestore parks the entry until the restore is ready, so the reveal order
  // doesn't depend on whether the (usually cached, near-instant) fetch beats the
  // pagereveal/load event. A backstop releases the masthead if the restore is slow —
  // so a cache-miss network fetch can't leave the page blank; its results then deal
  // in on their own when they land.
  var savedState = stateByAbbr(wxStore.get("state") || "");
  if (savedState) {
    awaitingRestore = true;
    selectEl.value = savedState.abbr;
    restoreState(savedState);
    setTimeout(function () {
      if (restoreReady) return;   // restore already drove (or will drive) the entry
      awaitingRestore = false;    // stop gating: a later playEntry runs immediately
      flushPendingEntry();        // release a parked entry now (masthead only)
    }, 900);
  }

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

    // Pagination card — deal a fixture whose lead alert overruns one card, to preview
    // the multi-card split (a long headline continues on the next card, titled p/N).
    devCardEl("dev-pagination",
      title("Pagination", "var(--orange)") +
      typeRow("Developer — Card Split", "ph-cards-three") +
      '<div class="card-text-box">' +
        "<p>Deal an over-long alert to preview the split: a headline that overruns one card continues on the next, titled (1/2, 2/2).</p>" +
        '<div class="btn-group">' +
          '<button class="btn btn--ghost btn--sm" id="wx-paginated"><i class="ph ph-cards-three"></i>Long alert</button>' +
        "</div>" +
      "</div>" +
      footer("WX DEV", "PAGINATION")
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
      forecastCard.set(forecastBody("Dev Preview", devPeriod(), new Date().toISOString()));
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
    var pagBtn = document.getElementById("wx-paginated");
    if (pagBtn) pagBtn.addEventListener("click", function () { dealFixture(CACHED_LONG); });
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

  // The portal handoff: puhig stashes an exit origin in the shared store's session
  // backend as it leaves the deck, so an arrival here reads as a portal morph.
  // Read (don't consume) it now to decide the pre-paint hide; the load fallback
  // below consumes it.
  var portalStore = window.puhig.store.area("portal", true);
  var arrivingViaPortal = portalStore.get("exitOrigin") != null;

  // Pre-deal hide: the masthead siblings start invisible (opacity only — their
  // slots stay laid out so the deal reads true rects) until the entry spits them
  // from the cover's centre. Without this they sit at rest in the first paint —
  // and, arriving through the portal, in the view-transition snapshot — then jerk
  // back to the cover to deal. On a direct load the cover is hidden too, so it
  // shows blank until its entry breathes it in — never a flash of the resting
  // cover before the animation; entryDeal clears the hide as it reveals it. Through
  // the portal the cover is the morph target, so it stays visible (never hidden).
  // Skipped under reduced motion, where no deal runs to reveal them.
  if (!reduceMotionMQ.matches) {
    mastCards().forEach(function (c) { c.style.opacity = "0"; });
    var coverSleeve = coverParts().sleeve;
    if (coverSleeve && !arrivingViaPortal) coverSleeve.style.opacity = "0";
  }

  // Page-load entry: cover pops in, then the masthead spits from its centre. Once.
  // pagereveal (where it fires) is preferred — it runs before the first paint and
  // reports, via e.viewTransition, whether the cover portal is morphing us in. A
  // cross-document portal arrival, though, doesn't reliably deliver pagereveal to
  // the new page, so we also arm a load fallback; whichever lands first plays the
  // entry. The fallback reads the portal arrival from the exit origin puhig stashes
  // in the shared store's session backend as it leaves the deck, consuming it so a
  // later direct reload reads as a direct load (cover pops) rather than a portal
  // arrival (cover held).
  if ("onpagereveal" in window) {
    window.addEventListener("pagereveal", function (e) { playEntry(!!e.viewTransition); });
  }
  window.addEventListener("load", function () {
    var viaPortal = portalStore.get("exitOrigin") != null;
    portalStore.del("exitOrigin");
    playEntry(viaPortal);
  });
})();
