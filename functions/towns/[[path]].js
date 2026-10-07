import { getPublishedVenues } from "../lib/published-venues-cache.js";
import { notFoundPage } from "../lib/not-found-page.js";
import { renderTownsIndex } from "../lib/render-directory-index.js";
import { renderTownPage } from "../lib/render-town-page.js";
import {
  findQualifyingTown,
  getQualifyingTowns,
  normalizeTownSlug
} from "../lib/towns.js";

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
      title: "Town not found",
      message:
        "That town doesn’t have enough verified happy hour hours yet — or the link is outdated."
    }),
    404,
    { "Cache-Control": "public, max-age=30" }
  );
}

/**
 * Dynamic town landing pages from the published-venues cache.
 * Canonical: /towns/royal-oak
 * Gate: MIN_TOWN_HOURS venues with hh_start + hh_end (see lib/towns.js).
 */
export async function onRequestGet(context) {
  const { request, env, params } = context;
  if (!env.DB) return html("<h1>Database unavailable</h1>", 503);

  const rawPath = Array.isArray(params.path)
    ? params.path.join("/")
    : params.path || "";
  const slug = normalizeTownSlug(rawPath);

  if (!slug || slug === "index") {
    try {
      const all = await getPublishedVenues(env, context);
      return html(renderTownsIndex(getQualifyingTowns(all)));
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      return html(`<h1>Error</h1><pre>${msg}</pre>`, 500, {
        "Cache-Control": "no-store"
      });
    }
  }

  const url = new URL(request.url);
  if (url.pathname.endsWith(".html")) {
    url.pathname = `/towns/${slug}`;
    return Response.redirect(url, 301);
  }

  try {
    const all = await getPublishedVenues(env, context);
    const town = findQualifyingTown(all, slug);
    if (!town) return notFound();

    const siblings = getQualifyingTowns(all);
    const page = renderTownPage(town, siblings);
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
