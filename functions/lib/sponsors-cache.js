/**
 * Edge-cached sponsor rows for town/region landing pages.
 * Mirrors published-venues-cache: Cache API TTL 300s + request memo.
 */

/** Synthetic cache key (not a real public URL). */
export const SPONSORS_CACHE_URL =
  "https://michiganhappyhour.internal/cache/sponsors-v1";

/** Edge TTL for the sponsors list (seconds). */
export const SPONSORS_TTL_SECONDS = 300;

const SPONSORS_SQL = `SELECT
  id, place_type, place_slug, name, url, tagline, image_url,
  starts_at, ends_at, active, created_at, updated_at
FROM sponsors
ORDER BY id DESC`;

function cacheKeyRequest() {
  return new Request(SPONSORS_CACHE_URL, { method: "GET" });
}

function memoGet(ctx) {
  return ctx?.data?._sponsorsMemo;
}

function memoSet(ctx, rows) {
  if (ctx && typeof ctx === "object") {
    if (!ctx.data) ctx.data = {};
    ctx.data._sponsorsMemo = rows;
  }
}

/**
 * Normalize a date-only or datetime string to YYYY-MM-DD for comparisons.
 * @param {string} s
 */
export function toDateOnly(s) {
  const t = String(s || "").trim();
  if (!t) return "";
  // Accept YYYY-MM-DD or full ISO; compare on calendar day in UTC-ish lexicographic order.
  return t.slice(0, 10);
}

/**
 * Whether a sponsor row is currently showable.
 * @param {object} row
 * @param {string} [today] YYYY-MM-DD (defaults to UTC today)
 */
export function isSponsorLive(row, today) {
  if (!row || !row.active) return false;
  const day = today || new Date().toISOString().slice(0, 10);
  const start = toDateOnly(row.starts_at);
  const end = toDateOnly(row.ends_at);
  if (!start || !end) return false;
  return start <= day && day <= end;
}

/**
 * Load all sponsor rows (Cache API → D1 on miss).
 * @param {object} env
 * @param {object} [ctx]
 * @returns {Promise<object[]>}
 */
export async function getSponsors(env, ctx) {
  const memo = memoGet(ctx);
  if (memo) return memo;

  const key = cacheKeyRequest();
  try {
    const cached = await caches.default.match(key);
    if (cached) {
      const rows = await cached.json();
      if (Array.isArray(rows)) {
        memoSet(ctx, rows);
        return rows;
      }
    }
  } catch {
    // Cache API unavailable in some local/preview contexts — fall through to D1.
  }

  const result = await env.DB.prepare(SPONSORS_SQL).all();
  const rows = result.results || [];
  memoSet(ctx, rows);

  const response = new Response(JSON.stringify(rows), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${SPONSORS_TTL_SECONDS}`
    }
  });

  const put = caches.default.put(key, response).catch(() => {});
  if (typeof ctx?.waitUntil === "function") ctx.waitUntil(put);
  else await put;

  return rows;
}

/**
 * Active exclusive sponsor for a town or region slug (date-windowed).
 * If multiple overlap, prefer the newest id.
 * @param {object} env
 * @param {'town'|'region'} placeType
 * @param {string} placeSlug
 * @param {object} [ctx]
 * @returns {Promise<object|null>}
 */
export async function getActiveSponsor(env, placeType, placeSlug, ctx) {
  const slug = String(placeSlug || "")
    .trim()
    .toLowerCase();
  if (!slug || (placeType !== "town" && placeType !== "region")) return null;

  const rows = await getSponsors(env, ctx);
  const today = new Date().toISOString().slice(0, 10);
  const matches = rows.filter(
    (r) =>
      r.place_type === placeType &&
      String(r.place_slug || "").toLowerCase() === slug &&
      isSponsorLive(r, today)
  );
  if (!matches.length) return null;
  matches.sort((a, b) => Number(b.id) - Number(a.id));
  return matches[0];
}

/**
 * Drop the sponsors cache entry in this colo after mutations.
 * @param {object} [ctx]
 */
export function invalidateSponsorsCache(ctx) {
  const del = caches.default.delete(cacheKeyRequest()).catch(() => false);
  if (typeof ctx?.waitUntil === "function") ctx.waitUntil(del);
  return del;
}
