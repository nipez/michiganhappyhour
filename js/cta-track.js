/**
 * Venue CTA + page analytics for Michigan Happy Hour.
 * Dual-writes to GA4 (gtag) and Cloudflare D1 via POST /api/track.
 *
 * Events: page_view, spot_view, cta_call, cta_map, cta_directions, cta_details
 */
(function () {
  var TRACK_URL = "/api/track";
  var VISITOR_KEY = "mhh_vid";
  var SESSION_KEY = "mhh_sid";
  var SESSION_TS_KEY = "mhh_sid_ts";
  var SESSION_MS = 30 * 60 * 1000;

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getVisitorId() {
    try {
      var id = localStorage.getItem(VISITOR_KEY);
      if (!id) {
        id = uuid();
        localStorage.setItem(VISITOR_KEY, id);
      }
      return id;
    } catch (e) {
      return uuid();
    }
  }

  function getSessionId() {
    try {
      var now = Date.now();
      var id = sessionStorage.getItem(SESSION_KEY);
      var ts = Number(sessionStorage.getItem(SESSION_TS_KEY) || 0);
      if (!id || !ts || now - ts > SESSION_MS) {
        id = uuid();
        sessionStorage.setItem(SESSION_KEY, id);
      }
      sessionStorage.setItem(SESSION_TS_KEY, String(now));
      return id;
    } catch (e) {
      return uuid();
    }
  }

  function utmFromLocation() {
    var params = new URLSearchParams(window.location.search || "");
    return {
      utm_source: params.get("utm_source") || undefined,
      utm_medium: params.get("utm_medium") || undefined,
      utm_campaign: params.get("utm_campaign") || undefined,
      utm_content: params.get("utm_content") || undefined,
      utm_term: params.get("utm_term") || undefined
    };
  }

  function baseContext() {
    var utm = utmFromLocation();
    return {
      path: window.location.pathname + window.location.search,
      title: document.title || undefined,
      referrer: document.referrer || undefined,
      visitor_id: getVisitorId(),
      session_id: getSessionId(),
      language: navigator.language || undefined,
      timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone) || undefined,
      screen_w: window.screen && screen.width,
      screen_h: window.screen && screen.height,
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
      user_agent: navigator.userAgent || undefined,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      utm_content: utm.utm_content,
      utm_term: utm.utm_term
    };
  }

  function clean(obj) {
    Object.keys(obj).forEach(function (k) {
      if (obj[k] == null || obj[k] === "") delete obj[k];
    });
    return obj;
  }

  function sendToD1(payload) {
    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(TRACK_URL, blob)) return;
      }
    } catch (e) {}
    try {
      fetch(TRACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body,
        keepalive: true,
        credentials: "omit"
      }).catch(function () {});
    } catch (e) {}
  }

  function trackCta(cta, spot) {
    if (!cta) return;

    var spotData = spot || {};
    var eventPayload = clean(Object.assign(baseContext(), {
      event_name: cta,
      cta: cta,
      spot_id: spotData.id != null ? String(spotData.id) : undefined,
      spot_name: spotData.name ? String(spotData.name) : undefined,
      town: spotData.town ? String(spotData.town) : undefined,
      page_type: spotData.page_type ? String(spotData.page_type) : guessPageType(),
      source: spotData.source ? String(spotData.source) : undefined,
      payload: spotData.payload ? spotData.payload : undefined
    }));

    // GA4
    if (typeof window.gtag === "function") {
      window.gtag("event", cta, clean({
        cta: cta,
        spot_id: eventPayload.spot_id,
        spot_name: eventPayload.spot_name,
        town: eventPayload.town,
        page_type: eventPayload.page_type,
        source: eventPayload.source
      }));
    }

    // Cloudflare D1
    sendToD1(eventPayload);
  }

  window.trackCta = trackCta;

  function guessPageType() {
    var path = window.location.pathname || "";
    if (/\/spots\//.test(path)) return "spot";
    if (/\/regions\//.test(path)) return "region";
    if (/\/map/.test(path)) return "map";
    if (/\/blog/.test(path)) return "blog";
    if (/\/collections\//.test(path)) return "collection";
    if (/\/submit/.test(path)) return "submit";
    if (path === "/" || path === "/index.html") return "home";
    return "other";
  }

  function slugFromPath() {
    var path = window.location.pathname || "";
    var m = path.match(/\/spots\/([^/]+?)(?:\.html)?\/?$/);
    return m ? m[1] : "";
  }

  function spotFromPage() {
    var h1 = document.querySelector("h1");
    var name = h1 ? h1.textContent.trim() : "";
    var town = "";
    var loc = document.querySelector(".cd h1 + div");
    if (loc) {
      var text = loc.textContent.trim();
      var parts = text.split("·");
      if (parts[0]) town = parts[0].replace(/,\s*MI\s*$/i, "").trim();
    }
    return {
      id: slugFromPath(),
      name: name,
      town: town,
      page_type: "spot"
    };
  }

  function bindSpotPage() {
    if (!/\/spots\//.test(window.location.pathname)) return;
    var spot = spotFromPage();
    if (!spot.name) return;

    trackCta("spot_view", Object.assign({}, spot, { source: "spot_page" }));

    document.querySelectorAll('a[href^="tel:"]').forEach(function (el) {
      if (el.dataset.ctaBound) return;
      el.dataset.ctaBound = "1";
      el.addEventListener("click", function () {
        trackCta("cta_call", Object.assign({}, spot, { source: "spot_page" }));
      });
    });

    document.querySelectorAll('a[href*="google.com/maps"]').forEach(function (el) {
      if (el.dataset.ctaBound) return;
      if (!el.classList.contains("bt") && !/Get Directions|Open in Google Maps/i.test(el.textContent)) return;
      el.dataset.ctaBound = "1";
      el.addEventListener("click", function () {
        trackCta("cta_directions", Object.assign({}, spot, { source: "spot_page" }));
      });
    });
  }

  function bindGlobalPageView() {
    var pageType = guessPageType();
    // spot_view already covers spot detail pages
    if (pageType === "spot") return;
    var h1 = document.querySelector("h1");
    trackCta("page_view", {
      page_type: pageType,
      name: h1 ? h1.textContent.trim() : document.title,
      source: "auto"
    });
  }

  function init() {
    bindSpotPage();
    bindGlobalPageView();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
