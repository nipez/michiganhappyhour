import { getPublishedVenues } from "../lib/published-venues-cache.js";
import { notFoundPage } from "../lib/not-found-page.js";
import { renderCollectionsIndex } from "../lib/render-directory-index.js";
import {
  COLLECTION_META,
  matchesCollection,
  normalizeCollectionSlug,
  renderCollectionPage
} from "../lib/render-collection-page.js";

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
    notFoundPage({
      title: "Collection not found",
      message: "That collection isn’t available."
    }),
    404
  );
}

export async function onRequestGet(context) {
  const { request, env, params } = context;
  if (!env.DB) return html("<h1>Database unavailable</h1>", 503);

  const rawPath = Array.isArray(params.path)
    ? params.path.join("/")
    : params.path || "";
  const slug = normalizeCollectionSlug(rawPath);
  if (!slug || slug === "index") {
    return html(renderCollectionsIndex());
  }
  if (!COLLECTION_META[slug]) return notFound();

  const url = new URL(request.url);
  if (url.pathname.endsWith(".html")) {
    url.pathname = `/collections/${slug}`;
    return Response.redirect(url, 301);
  }

  try {
    const all = await getPublishedVenues(env, context);
    const venues = all.filter((v) => matchesCollection(v, slug));
    // Prefer listing spots with verified hours first inside each region grouping (render sorts by region name)
    venues.sort((a, b) => {
      const ah = a.hh_start ? 0 : 1;
      const bh = b.hh_start ? 0 : 1;
      if (ah !== bh) return ah - bh;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
    const page = renderCollectionPage(slug, venues);
    if (!page) return notFound();
    return html(page);
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    return html(`<h1>Error</h1><pre>${msg}</pre>`, 500, { "Cache-Control": "no-store" });
  }
}
