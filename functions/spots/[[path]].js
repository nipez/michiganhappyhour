import { slugify } from "../api/_venues.js";
import {
  canonicalSpotPath,
  normalizeSpotSlug,
  renderSpotPage,
  venueSlug
} from "../lib/render-spot-page.js";

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
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Spot not found</title>
<meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:system-ui,sans-serif;background:#F5F7FA;color:#1B2838;padding:40px 20px;text-align:center}a{color:#E8614D;font-weight:700}</style>
</head><body><h1>Spot not found</h1><p>That listing isn’t published (or the link is outdated).</p><p><a href="/">Browse all happy hours</a></p></body></html>`,
    404,
    { "Cache-Control": "public, max-age=30" }
  );
}

async function findVenueBySlug(db, slug) {
  // Fast path: spot_path basename match
  const byPath = await db
    .prepare(
      `SELECT * FROM venues
       WHERE status = 'published'
         AND (spot_path = ? OR spot_path LIKE ?)
       LIMIT 1`
    )
    .bind(`../spots/${slug}.html`, `%/${slug}.html`)
    .first();
  if (byPath) return { venue: byPath, redirectTo: null };

  const rows = await db
    .prepare(`SELECT * FROM venues WHERE status = 'published'`)
    .all();
  const list = rows.results || [];

  // Accept current slugify(name,town) even if spot_path is stale
  let match = list.find((v) => slugify(v.name, v.town) === slug);
  if (match) {
    const canonical = venueSlug(match);
    return {
      venue: match,
      redirectTo: canonical !== slug ? canonicalSpotPath(match) : null
    };
  }

  // Soft match: slug starts with name slug (handles town renames like glen-arbor → leland)
  const nameMatches = list.filter((v) => {
    const nameSlug = slugify(v.name, "").replace(/-$/, "");
    return nameSlug && (slug === nameSlug || slug.startsWith(nameSlug + "-"));
  });
  if (nameMatches.length === 1) {
    const v = nameMatches[0];
    return { venue: v, redirectTo: canonicalSpotPath(v) };
  }

  return null;
}

/**
 * Dynamic spot pages from D1.
 * Canonical: /spots/the-parlor-traverse-city
 * Legacy .html URLs 301 → bare (matches Cloudflare Pages HTML handling elsewhere).
 */
export async function onRequestGet(context) {
  const { request, env, params } = context;
  if (!env.DB) {
    return html("<h1>Database unavailable</h1>", 503);
  }

  const rawPath = Array.isArray(params.path)
    ? params.path.join("/")
    : params.path || "";
  const slug = normalizeSpotSlug(rawPath);
  if (!slug || slug === "index") {
    return Response.redirect(new URL("/", request.url), 302);
  }

  try {
    const found = await findVenueBySlug(env.DB, slug);
    if (!found) return notFound();

    if (found.redirectTo) {
      const url = new URL(found.redirectTo, request.url);
      return Response.redirect(url, 301);
    }

    // Prefer extensionless URLs (Cloudflare Pages + GSC already use bare paths)
    const url = new URL(request.url);
    if (url.pathname.endsWith(".html")) {
      url.pathname = canonicalSpotPath(found.venue);
      return Response.redirect(url, 301);
    }

    const relatedRows = await env.DB.prepare(
      `SELECT id, name, town, address, hh_start, hh_end, spot_path, region
       FROM venues
       WHERE status = 'published' AND region = ? AND id != ?
       ORDER BY featured DESC, name COLLATE NOCASE ASC
       LIMIT 6`
    )
      .bind(found.venue.region, found.venue.id)
      .all();

    const page = renderSpotPage(found.venue, relatedRows.results || []);
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
