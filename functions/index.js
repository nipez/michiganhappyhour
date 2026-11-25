/**
 * Homepage Function: inject live published-spot count into title/meta
 * using getPublishedVenues() (Cache API + request memo — no extra D1 read
 * beyond the shared published-venues cache).
 */
import { getPublishedVenues } from "./lib/published-venues-cache.js";
import { buildHomeSeo } from "./lib/home-seo.js";

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function injectHomeSeo(html, seo) {
  const { title, desc, countLabel } = seo;
  let out = html;
  out = out.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  out = out.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeAttr(desc)}">`
  );
  out = out.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${escapeAttr(title)}">`
  );
  out = out.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${escapeAttr(desc)}">`
  );
  out = out.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${escapeAttr(title)}">`
  );
  out = out.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${escapeAttr(desc)}">`
  );
  // Keep WebSite JSON-LD description in sync when present.
  out = out.replace(
    /("description"\s*:\s*")Find happy hour near you[^"]*(")/,
    `$1Find happy hour near you across Michigan — ${countLabel} bars and restaurants with verified hours, drink specials, and maps by city. Updated weekly.$2`
  );
  // Noscript H1 count when present.
  out = out.replace(
    /Michigan Happy Hour Guide — [\d,]+(\+)? Happy Hours Across Michigan/i,
    `Michigan Happy Hour Guide — ${countLabel} Happy Hours Across Michigan`
  );
  return out;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  let seo = buildHomeSeo(1270);
  try {
    if (env.DB) {
      const venues = await getPublishedVenues(env, context);
      seo = buildHomeSeo(venues.length);
    }
  } catch {
    // Fall through with static fallback count — still serve the page.
  }

  // ASSETS.fetch bypasses Functions (no recursion) and serves static index.html.
  const assetReq = new Request(new URL("/", request.url), request);
  let assetRes;
  try {
    assetRes = await env.ASSETS.fetch(assetReq);
  } catch {
    return new Response("<h1>Homepage unavailable</h1>", {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  const html = await assetRes.text();
  const body = injectHomeSeo(html, seo);

  const headers = new Headers(assetRes.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "public, max-age=60, s-maxage=300");

  return new Response(body, { status: assetRes.status, headers });
}
