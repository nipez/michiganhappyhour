import { json, options, requireAdmin } from "./_auth.js";

const CTA_EVENTS = ["cta_call", "cta_map", "cta_directions", "cta_details", "spot_view", "page_view", "submit_success"];

function clampDays(raw) {
  const n = Number(raw || 30);
  if (!Number.isFinite(n)) return 30;
  return Math.min(Math.max(Math.trunc(n), 1), 365);
}

function emptyCounts() {
  return {
    spot_view: 0,
    cta_call: 0,
    cta_map: 0,
    cta_directions: 0,
    cta_details: 0,
    page_view: 0,
    submit_success: 0,
    other: 0,
    total_cta: 0,
    total_events: 0
  };
}

function accumulate(counts, eventName, n) {
  const c = Number(n) || 0;
  counts.total_events += c;
  if (Object.prototype.hasOwnProperty.call(counts, eventName) && eventName !== "total_cta" && eventName !== "total_events" && eventName !== "other") {
    counts[eventName] += c;
  } else {
    counts.other += c;
  }
  if (eventName === "cta_call" || eventName === "cta_map" || eventName === "cta_directions" || eventName === "cta_details") {
    counts.total_cta += c;
  }
}

function buildSummary({ spot, town, days, counts }) {
  const place = town ? `${spot} (${town})` : spot;
  const lines = [
    `${place} — Michigan Happy Hour report`,
    `Period: last ${days} days`,
    "",
    `Spot page views: ${counts.spot_view}`,
    `Call taps: ${counts.cta_call}`,
    `Map taps: ${counts.cta_map}`,
    `Directions taps: ${counts.cta_directions}`,
    `Details taps: ${counts.cta_details}`,
    `Total CTA taps: ${counts.total_cta}`,
    "",
    "Source: michiganhappyhour.com (Cloudflare analytics)",
    "Interested in claiming/featuring this listing? https://michiganhappyhour.com/for-business/"
  ];
  return lines.join("\n");
}

export async function onRequestOptions() {
  return options();
}

/**
 * GET /api/admin/reports?days=30
 * GET /api/admin/reports?days=30&spot=The%20Little%20Fleet
 * GET /api/admin/reports?days=30&town=Traverse%20City
 * Authorization: Bearer <ADMIN_PASSWORD>
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: "DB binding missing" }, 500);

  const auth = requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const days = clampDays(url.searchParams.get("days"));
  const spot = (url.searchParams.get("spot") || "").trim();
  const town = (url.searchParams.get("town") || "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 25) || 25, 1), 100);

  try {
    // Spot name autocomplete / picker list
    const spotsRes = await env.DB.prepare(
      `SELECT spot_name, town, COUNT(*) AS events
       FROM events
       WHERE spot_name IS NOT NULL AND spot_name != ''
         AND created_at >= datetime('now', ?)
       GROUP BY spot_name, town
       ORDER BY events DESC
       LIMIT 300`
    )
      .bind(`-${days} days`)
      .all();

    // Top outreach list (by total CTA events)
    const topRes = await env.DB.prepare(
      `SELECT spot_name, town,
              SUM(CASE WHEN event_name = 'cta_call' THEN 1 ELSE 0 END) AS cta_call,
              SUM(CASE WHEN event_name = 'cta_map' THEN 1 ELSE 0 END) AS cta_map,
              SUM(CASE WHEN event_name = 'cta_directions' THEN 1 ELSE 0 END) AS cta_directions,
              SUM(CASE WHEN event_name = 'cta_details' THEN 1 ELSE 0 END) AS cta_details,
              SUM(CASE WHEN event_name = 'spot_view' THEN 1 ELSE 0 END) AS spot_view,
              SUM(CASE WHEN event_name IN ('cta_call','cta_map','cta_directions','cta_details') THEN 1 ELSE 0 END) AS total_cta,
              COUNT(*) AS total_events
       FROM events
       WHERE spot_name IS NOT NULL AND spot_name != ''
         AND created_at >= datetime('now', ?)
         ${town ? "AND town = ?" : ""}
       GROUP BY spot_name, town
       ORDER BY total_cta DESC, spot_view DESC, total_events DESC
       LIMIT ?`
    );

    const top = town
      ? await topRes.bind(`-${days} days`, town, limit).all()
      : await topRes.bind(`-${days} days`, limit).all();

    let spotReport = null;
    if (spot) {
      const byEvent = await env.DB.prepare(
        `SELECT event_name, COUNT(*) AS count
         FROM events
         WHERE created_at >= datetime('now', ?)
           AND spot_name = ?
           ${town ? "AND town = ?" : ""}
         GROUP BY event_name
         ORDER BY count DESC`
      );

      const eventRows = town
        ? await byEvent.bind(`-${days} days`, spot, town).all()
        : await byEvent.bind(`-${days} days`, spot).all();

      const counts = emptyCounts();
      (eventRows.results || []).forEach((row) => accumulate(counts, row.event_name, row.count));

      const recent = await env.DB.prepare(
        `SELECT id, created_at, event_name, source, page_type, path, country, city
         FROM events
         WHERE spot_name = ?
           ${town ? "AND town = ?" : ""}
         ORDER BY id DESC
         LIMIT 30`
      );

      const recentRows = town
        ? await recent.bind(spot, town).all()
        : await recent.bind(spot).all();

      // Prefer town from query or from first matching spot list entry
      const matched = (spotsRes.results || []).find((s) => s.spot_name === spot && (!town || s.town === town));
      const reportTown = town || matched?.town || null;

      spotReport = {
        spot_name: spot,
        town: reportTown,
        days,
        counts,
        by_event: eventRows.results || [],
        recent: recentRows.results || [],
        summary_text: buildSummary({
          spot,
          town: reportTown,
          days,
          counts
        })
      };
    }

    // Site-wide totals for context
    const siteTotals = await env.DB.prepare(
      `SELECT event_name, COUNT(*) AS count
       FROM events
       WHERE created_at >= datetime('now', ?)
       GROUP BY event_name
       ORDER BY count DESC`
    )
      .bind(`-${days} days`)
      .all();

    return json({
      ok: true,
      days,
      town: town || null,
      cta_events: CTA_EVENTS,
      spots: spotsRes.results || [],
      top_spots: top.results || [],
      site_totals: siteTotals.results || [],
      spot_report: spotReport
    });
  } catch (err) {
    return json({ ok: false, error: "Query failed", detail: String(err && err.message ? err.message : err) }, 500);
  }
}
