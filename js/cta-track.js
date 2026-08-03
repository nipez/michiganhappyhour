/**
 * Venue CTA tracking for Michigan Happy Hour (GA4).
 * Events: spot_view, cta_call, cta_map, cta_directions, cta_details
 *
 * In GA4 Admin → Events, mark the cta_* events as Key events.
 * Explore → Free form: Rows = spot_name, Columns = event_name.
 */
(function () {
  function trackCta(cta, spot) {
    if (!cta) return;
    var params = {
      cta: cta,
      spot_id: spot && spot.id != null ? String(spot.id) : undefined,
      spot_name: spot && spot.name ? String(spot.name) : undefined,
      town: spot && spot.town ? String(spot.town) : undefined,
      page_type: spot && spot.page_type ? String(spot.page_type) : undefined,
      source: spot && spot.source ? String(spot.source) : undefined
    };
    Object.keys(params).forEach(function (k) {
      if (params[k] == null || params[k] === "") delete params[k];
    });

    if (typeof window.gtag === "function") {
      window.gtag("event", cta, params);
    }
  }

  window.trackCta = trackCta;

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
      // Skip bare embed iframes (handled separately); only track CTA-style links.
      if (!el.classList.contains("bt") && !/Get Directions|Open in Google Maps/i.test(el.textContent)) return;
      el.dataset.ctaBound = "1";
      el.addEventListener("click", function () {
        trackCta("cta_directions", Object.assign({}, spot, { source: "spot_page" }));
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindSpotPage);
  } else {
    bindSpotPage();
  }
})();
