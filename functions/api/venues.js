import { toListVenue, toMapVenue, toFullVenue } from "./_venues.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "public, max-age=30"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * GET /api/venues
 * Public published venues.
 * Query: format=list|map|full (default list), region=, q=
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: "DB binding missing" }, 500);

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") || "list").toLowerCase();
  const region = (url.searchParams.get("region") || "").trim();
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();

  try {
    let sql = `SELECT * FROM venues WHERE status = 'published'`;
    const binds = [];
    if (region) {
      sql += ` AND region = ?`;
      binds.push(region);
    }
    sql += ` ORDER BY featured DESC, name COLLATE NOCASE ASC`;

    const result = binds.length
      ? await env.DB.prepare(sql).bind(...binds).all()
      : await env.DB.prepare(sql).all();

    let rows = result.results || [];
    if (q) {
      rows = rows.filter((r) => {
        const hay = `${r.name} ${r.town} ${r.address || ""} ${r.category || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    const mapper =
      format === "map" ? toMapVenue : format === "full" ? toFullVenue : toListVenue;

    return json({
      ok: true,
      count: rows.length,
      format: format === "map" || format === "full" ? format : "list",
      venues: rows.map(mapper)
    });
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    // Table may not exist yet pre-migration
    if (msg.includes("no such table")) {
      return json({ ok: false, error: "venues table missing — run migration 0003", detail: msg }, 503);
    }
    return json({ ok: false, error: "Query failed", detail: msg }, 500);
  }
}
