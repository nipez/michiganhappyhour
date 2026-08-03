const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * Quick read API for testing.
 * GET /api/stats
 * GET /api/stats?spot=The%20Little%20Fleet
 * GET /api/stats?days=7
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: "DB binding missing" }, 500);

  const url = new URL(request.url);
  const spot = (url.searchParams.get("spot") || "").trim();
  const days = Math.min(Math.max(Number(url.searchParams.get("days") || 30) || 30, 1), 365);

  try {
    const totals = await env.DB.prepare(
      `SELECT event_name, COUNT(*) AS count
       FROM events
       WHERE created_at >= datetime('now', ?)
       GROUP BY event_name
       ORDER BY count DESC`
    )
      .bind(`-${days} days`)
      .all();

    let bySpot;
    if (spot) {
      bySpot = await env.DB.prepare(
        `SELECT event_name, COUNT(*) AS count
         FROM events
         WHERE created_at >= datetime('now', ?)
           AND (spot_name = ? OR spot_id = ?)
         GROUP BY event_name
         ORDER BY count DESC`
      )
        .bind(`-${days} days`, spot, spot)
        .all();
    } else {
      bySpot = await env.DB.prepare(
        `SELECT COALESCE(spot_name, '(none)') AS spot_name, event_name, COUNT(*) AS count
         FROM events
         WHERE created_at >= datetime('now', ?)
           AND spot_name IS NOT NULL
         GROUP BY spot_name, event_name
         ORDER BY count DESC
         LIMIT 100`
      )
        .bind(`-${days} days`)
        .all();
    }

    const recent = await env.DB.prepare(
      `SELECT id, created_at, event_name, spot_name, town, page_type, source, path, country, city
       FROM events
       ORDER BY id DESC
       LIMIT 25`
    ).all();

    const countRow = await env.DB.prepare(`SELECT COUNT(*) AS total FROM events`).first();

    return json({
      ok: true,
      days,
      spot: spot || null,
      total_events: countRow?.total ?? 0,
      totals: totals.results || [],
      by_spot: bySpot.results || [],
      recent: recent.results || []
    });
  } catch (err) {
    return json({ ok: false, error: "Query failed", detail: String(err && err.message ? err.message : err) }, 500);
  }
}
