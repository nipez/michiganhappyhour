import {
  getPublishedVenues,
  regionCountsFromVenues
} from "../lib/published-venues-cache.js";
import {
  normalizeRegionSlug,
  REGION_META,
  renderRegionPage
} from "../lib/render-region-page.js";

function html(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=120",
      ...extraHeaders
    }
  });
}

function notFound() {
  return html(
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Region not found</title>
<meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,sans-serif;background:#F5F7FA;color:#1B2838;padding:40px 20px;text-align:center}a{color:#E8614D;font-weight:700}</style>
</head><body><h1>Region not found</h1><p>That region page isn’t available.</p><p><a href="/">Browse all happy hours</a></p></body></html>`,
    404,
    { "Cache-Control": "public, max-age=30" }
  );
}

/**
 * Dynamic region landing pages from D1.
 * Canonical: /regions/detroit
 * Legacy .html URLs 301 → bare.
 */
export async function onRequestGet(context) {
  const { request, env, params } = context;
  if (!env.DB) return html("<h1>Database unavailable</h1>", 503);

  const rawPath = Array.isArray(params.path)
    ? params.path.join("/")
    : params.path || "";
  const slug = normalizeRegionSlug(rawPath);

  if (!slug || slug === "index") {
    return Response.redirect(new URL("/", request.url), 302);
  }

  if (!REGION_META[slug]) return notFound();

  const url = new URL(request.url);
  if (url.pathname.endsWith(".html")) {
    url.pathname = `/regions/${slug}`;
    return Response.redirect(url, 301);
  }

  try {
    const all = await getPublishedVenues(env, context);
    const venues = all.filter((v) => v.region === slug);
    const counts = regionCountsFromVenues(all);

    const page = renderRegionPage(slug, venues, counts);
    if (!page) return notFound();
    return html(page);
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (msg.includes("no such table")) {
      return html("<h1>Venues not migrated yet</h1>", 503);
    }
    return html(`<h1>Error</h1><pre>${msg}</pre>`, 500, {
      "Cache-Control": "no-store"
    });
  }
}
