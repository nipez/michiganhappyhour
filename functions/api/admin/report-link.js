import { json, options, requireAdmin } from "./_auth.js";
import { reportToken } from "../../lib/stripe.js";

/**
 * GET /api/admin/report-link?id=123
 * Returns a signed owner-report URL for sharing with a venue.
 */
export async function onRequestOptions() {
  return options();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: "DB binding missing" }, 500);
  const auth = requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id") || "");
  if (!Number.isFinite(id) || id <= 0) return json({ ok: false, error: "id required" }, 400);

  const venue = await env.DB.prepare(
    `SELECT id, name, town FROM venues WHERE id = ?`
  )
    .bind(id)
    .first();
  if (!venue) return json({ ok: false, error: "Not found" }, 404);

  try {
    const token = await reportToken(env, id);
    const origin = new URL(request.url).origin;
    const reportUrl = `${origin}/owner-report?v=${id}&t=${token}`;
    return json({
      ok: true,
      venue_id: id,
      name: venue.name,
      town: venue.town,
      report_url: reportUrl
    });
  } catch (err) {
    return json(
      {
        ok: false,
        error: "Could not sign report link",
        detail: String(err && err.message ? err.message : err)
      },
      503
    );
  }
}
