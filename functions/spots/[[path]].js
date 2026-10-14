import { slugify } from "../api/_venues.js";
import {
  getPublishedVenues,
  regionCountsFromVenues
} from "../lib/published-venues-cache.js";
import { notFoundPage } from "../lib/not-found-page.js";
import { renderSpotsIndex } from "../lib/render-directory-index.js";
import {
  canonicalSpotPath,
  normalizeSpotSlug,
  renderSpotMarkdown,
  renderSpotPage,
  venueSlug
} from "../lib/render-spot-page.js";
import { findQualifyingTown, getQualifyingTowns } from "../lib/towns.js";

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

function markdown(body) {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      // no-store so a shared/edge cache can never hand a Markdown variant to a
      // browser (Cloudflare's cache does not reliably honor `Vary: Accept`).
      "Cache-Control": "no-store",
      Vary: "Accept"
    }
  });
}

/** True when the client explicitly opts into Markdown via content negotiation. */
function prefersMarkdown(request) {
  const accept = (request.headers.get("Accept") || "").toLowerCase();
  return accept.includes("text/markdown");
}

function notFound() {
  return html(
    notFoundPage({
      title: "Spot not found",
      message: "That listing isn’t published (or the link is outdated)."
    }),
    404,
    { "Cache-Control": "public, max-age=30" }
  );
}

function findVenueBySlug(venues, slug) {
  const list = venues || [];

  // Fast path: spot_path basename match
  const byPath = list.find((v) => {
    const path = String(v.spot_path || "");
    return path === `../spots/${slug}.html` || path.endsWith(`/${slug}.html`);
  });
  if (byPath) return { venue: byPath, redirectTo: null };

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
    try {
      const venues = await getPublishedVenues(env, context);
      const counts = regionCountsFromVenues(venues);
      const towns = getQualifyingTowns(venues);
      return html(renderSpotsIndex(counts, towns));
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      return html(`<h1>Error</h1><pre>${msg}</pre>`, 500, {
        "Cache-Control": "no-store"
      });
    }
  }

  try {
    const venues = await getPublishedVenues(env, context);
    const found = findVenueBySlug(venues, slug);
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

    const related = venues
      .filter((v) => v.region === found.venue.region && v.id !== found.venue.id)
      .slice(0, 6)
      .map((v) => ({
        id: v.id,
        name: v.name,
        town: v.town,
        address: v.address,
        hh_start: v.hh_start,
        hh_end: v.hh_end,
        spot_path: v.spot_path,
        region: v.region
      }));

    const town = findQualifyingTown(venues, found.venue.town);

    if (prefersMarkdown(request)) {
      return markdown(renderSpotMarkdown(found.venue, related));
    }

    // Vary signals intent to caches/CDNs that this URL negotiates on Accept.
    const page = renderSpotPage(found.venue, related, {
      townQualifies: Boolean(town),
      townPageSlug: town?.slug || ""
    });
    return html(page, 200, { Vary: "Accept" });  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (msg.includes("no such table")) {
      return html("<h1>Venues not migrated yet</h1>", 503);
    }
    return html(`<h1>Error</h1><pre>${msg}</pre>`, 500, {
      "Cache-Control": "no-store"
    });
  }
}
