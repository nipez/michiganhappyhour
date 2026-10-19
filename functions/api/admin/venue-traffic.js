import { json, options, requireAdmin } from "./_auth.js";
import {
  buildClaimedVenueTrafficReport,
  getVenueMonthTraffic,
  reportToCsv,
  resolveMonth
} from "../../lib/venue-traffic.js";

export async function onRequestOptions() {
  return options();
}

/**
 * GET /api/admin/venue-traffic?month=YYYY-MM
 * GET /api/admin/venue-traffic?month=YYYY-MM&venue_id=123
 * GET /api/admin/venue-traffic?month=YYYY-MM&format=csv
 * Authorization: Bearer <ADMIN_PASSWORD>
 *
 * Calendar-month traffic for claimed venues (views, calls, map, directions, website)
 * plus previous-month deltas. Designed for reuse by claim outreach.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: "DB binding missing" }, 500);

  const auth = requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const monthRaw = url.searchParams.get("month");
  const format = (url.searchParams.get("format") || "json").toLowerCase();
  const venueIdRaw = url.searchParams.get("venue_id");
  const skipCache = url.searchParams.get("refresh") === "1";

  let bounds;
  try {
    bounds = resolveMonth(monthRaw);
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) }, 400);
  }

  try {
    const venueId = venueIdRaw != null && venueIdRaw !== "" ? Number(venueIdRaw) : null;
    const report =
      Number.isFinite(venueId) && venueId > 0
        ? await getVenueMonthTraffic(env, venueId, bounds.month, {
            skipCache,
            ctx: context
          })
        : await buildClaimedVenueTrafficReport(env, bounds.month, {
            skipCache,
            ctx: context
          });

    if (format === "csv") {
      const csv = reportToCsv(report);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="claimed-venue-traffic-${report.month}.csv"`,
          "Cache-Control": "private, no-store",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }

    return json(report);
  } catch (err) {
    return json(
      {
        ok: false,
        error: "Query failed",
        detail: String(err && err.message ? err.message : err)
      },
      500
    );
  }
}
