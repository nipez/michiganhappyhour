/**
 * Shared cache for published venue rows.
 *
 * Public pages (homepage API, map, spots, regions, collections) previously
 * each re-ran full-table D1 SELECTs. With ~1.3k venues, every request burned
 * that many row reads. This module keeps one edge-cached JSON list and lets
 * callers filter in memory.
 *
 * Storage: Workers/Pages Cache API (`caches.default`) — no KV binding, no
 * paid plan. Per-colo; TTL bounds staleness when delete only hits one colo.
 */

/** Synthetic cache key (not a real public URL). */
export const PUBLISHED_VENUES_CACHE_URL =
  "https://michiganhappyhour.internal/cache/published-venues-v1";

/** Edge TTL for the published-venue list (seconds). */
export const PUBLISHED_VENUES_TTL_SECONDS = 300;

/**
 * Columns used by public list/map/spot/region/collection renderers.
 * Omits admin_notes and Stripe ids so the cached payload stays lean.
 */
const PUBLISHED_VENUES_SQL = `SELECT
  id, name, category, region, region_name, region_color, town, address,
  phone, website, opening_hours, hh_start, hh_end, hh_days, deals, vibe,
  lat, lng, featured, claimed, claimed_at, dog_friendly, collections, spot_path,
  status, source, external_id, last_verified_at, created_at, updated_at
FROM venues
WHERE status = 'published'
ORDER BY featured DESC, name COLLATE NOCASE ASC`;

function cacheKeyRequest() {
  return new Request(PUBLISHED_VENUES_CACHE_URL, { method: "GET" });
}

function memoGet(ctx) {
  return ctx?.data?._publishedVenuesMemo;
}

function memoSet(ctx, venues) {
  if (ctx && typeof ctx === "object") {
    if (!ctx.data) ctx.data = {};
    ctx.data._publishedVenuesMemo = venues;
  }
}

/**
 * Load all published venues (Cache API → D1 on miss).
 * @param {object} env Pages/Workers env with DB binding
 * @param {object} [ctx] Pages context (waitUntil + request-scoped memo)
 * @returns {Promise<object[]>}
 */
export async function getPublishedVenues(env, ctx) {
  const memo = memoGet(ctx);
  if (memo) return memo;

  const key = cacheKeyRequest();
  try {
    const cached = await caches.default.match(key);
    if (cached) {
      const venues = await cached.json();
      if (Array.isArray(venues)) {
        memoSet(ctx, venues);
        return venues;
      }
    }
  } catch {
    // Cache API unavailable in some local/preview contexts — fall through to D1.
  }

  const result = await env.DB.prepare(PUBLISHED_VENUES_SQL).all();
  const venues = result.results || [];
  memoSet(ctx, venues);

  const response = new Response(JSON.stringify(venues), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${PUBLISHED_VENUES_TTL_SECONDS}`
    }
  });

  const put = caches.default.put(key, response).catch(() => {});
  if (typeof ctx?.waitUntil === "function") ctx.waitUntil(put);
  else await put;

  return venues;
}

/**
 * Drop the published-venue cache entry in this colo after mutations.
 * Other colos expire via TTL (max PUBLISHED_VENUES_TTL_SECONDS).
 * @param {object} [ctx]
 */
export function invalidatePublishedVenuesCache(ctx) {
  const del = caches.default.delete(cacheKeyRequest()).catch(() => false);
  if (typeof ctx?.waitUntil === "function") ctx.waitUntil(del);
  return del;
}

/** Region → published count from an in-memory venue list. */
export function regionCountsFromVenues(venues) {
  const counts = {};
  for (const v of venues || []) {
    if (!v?.region) continue;
    counts[v.region] = (counts[v.region] || 0) + 1;
  }
  return counts;
}
