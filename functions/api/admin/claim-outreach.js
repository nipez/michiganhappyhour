import { json, options, requireAdmin } from "./_auth.js";
import {
  buildClaimOutreachReport,
  getVenueMonthTraffic,
  resolveMonth
} from "../../lib/venue-traffic.js";
import {
  buildOutreachEmail,
  buildOutreachSms,
  claimTrafficUrl,
  ensureOutreachToken,
  mailtoHref,
  outreachSubject
} from "../../lib/claim-outreach.js";

export async function onRequestOptions() {
  return options();
}

/**
 * GET /api/admin/claim-outreach?month=YYYY-MM
 * GET /api/admin/claim-outreach?month=YYYY-MM&venue_id=123&ensure_token=1
 * POST /api/admin/claim-outreach  { venue_id, rotate?: true }
 *
 * Unclaimed-venue outreach list with private traffic links + copy-ready pitch.
 * Does not send email.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: "DB binding missing" }, 500);

  const auth = requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const monthRaw = url.searchParams.get("month");
  const venueIdRaw = url.searchParams.get("venue_id");
  const ensureToken = url.searchParams.get("ensure_token") === "1";
  const skipCache = url.searchParams.get("refresh") === "1";
  const limit = url.searchParams.get("limit");

  let bounds;
  try {
    bounds = resolveMonth(monthRaw);
  } catch (err) {
    return json({ ok: false, error: String(err.message || err) }, 400);
  }

  const origin = url.origin;
  const venueId =
    venueIdRaw != null && venueIdRaw !== "" ? Number(venueIdRaw) : null;

  try {
    if (Number.isFinite(venueId) && venueId > 0) {
      return json(
        await buildOneOutreach(env, venueId, bounds.month, origin, {
          ensureToken,
          skipCache,
          ctx: context
        })
      );
    }

    const report = await buildClaimOutreachReport(env, bounds.month, {
      skipCache,
      ctx: context,
      limit: limit ? Number(limit) : 100
    });

    // Tokens already on rows when present; do not mint on list load (POST / ensure_token).
    const venues = (report.venues || []).map((v) => {
      const token = v.outreach_token || null;
      const trafficUrl = token ? claimTrafficUrl(origin, token) : null;
      return enrichCopy(v, report.month_label, trafficUrl, token);
    });

    return json({
      ...report,
      venues
    });
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

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: "DB binding missing" }, 500);

  const auth = requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const venueId = Number(body.venue_id || body.id || "");
  const rotate = Boolean(body.rotate);
  const monthRaw = body.month || null;

  if (!Number.isFinite(venueId) || venueId <= 0) {
    return json({ ok: false, error: "venue_id required" }, 400);
  }

  try {
    const { token, created } = await ensureOutreachToken(env, venueId, { rotate });
    const origin = new URL(request.url).origin;
    const trafficUrl = claimTrafficUrl(origin, token);

    let bounds;
    try {
      bounds = resolveMonth(monthRaw);
    } catch (err) {
      return json({ ok: false, error: String(err.message || err) }, 400);
    }

    const one = await buildOneOutreach(env, venueId, bounds.month, origin, {
      ensureToken: false,
      skipCache: true,
      ctx: context,
      token,
      trafficUrl
    });

    return json({
      ...one,
      token,
      token_created: created,
      token_rotated: rotate && created
    });
  } catch (err) {
    return json(
      {
        ok: false,
        error: "Could not create outreach link",
        detail: String(err && err.message ? err.message : err)
      },
      500
    );
  }
}

async function buildOneOutreach(env, venueId, month, origin, opts) {
  let token = opts.token || null;
  let trafficUrl = opts.trafficUrl || null;

  if (opts.ensureToken || !token) {
    if (opts.ensureToken) {
      const ensured = await ensureOutreachToken(env, venueId, { rotate: false });
      token = ensured.token;
      trafficUrl = claimTrafficUrl(origin, token);
    } else {
      const row = await env.DB.prepare(
        `SELECT outreach_token FROM venues WHERE id = ?`
      )
        .bind(venueId)
        .first();
      token = row?.outreach_token || null;
      if (token) trafficUrl = claimTrafficUrl(origin, token);
    }
  }

  const report = await getVenueMonthTraffic(env, venueId, month, {
    skipCache: opts.skipCache,
    ctx: opts.ctx
  });
  const venue = report.venue;
  if (!venue) {
    return { ok: false, error: "Venue not found or not published", status: 404 };
  }

  // Attach presentation already on report
  const enriched = {
    ...venue,
    email: null,
    presentation: report.presentation,
    town_metrics: report.town_metrics,
    has_outreach_token: Boolean(token)
  };

  // Optional email from submissions (single bounded query)
  try {
    const sub = await env.DB.prepare(
      `SELECT email FROM submissions
       WHERE email IS NOT NULL AND email != ''
         AND lower(name) = lower(?)
         AND (town IS NULL OR town = '' OR lower(town) = lower(?))
       ORDER BY id DESC LIMIT 1`
    )
      .bind(venue.name, venue.town || "")
      .first();
    if (sub?.email) enriched.email = String(sub.email).trim();
  } catch {
    /* ignore */
  }

  return {
    ok: true,
    month: report.month,
    month_label: report.month_label,
    prev_month: report.prev_month,
    prev_month_label: report.prev_month_label,
    venue: enrichCopy(enriched, report.month_label, trafficUrl, token)
  };
}

function enrichCopy(v, monthLabel, trafficUrl, token) {
  const email_body = buildOutreachEmail({
    venue: v,
    monthLabel,
    trafficUrl
  });
  const sms_body = buildOutreachSms({
    venue: v,
    monthLabel,
    trafficUrl
  });
  const subject = outreachSubject(v);
  return {
    ...v,
    outreach_token: token || null,
    traffic_url: trafficUrl || null,
    claim_url: `https://michiganhappyhour.com/for-business/?${new URLSearchParams({
      name: v.name || "",
      town: v.town || "",
      interest: "featured"
    }).toString()}#claim`,
    email_subject: subject,
    email_body,
    sms_body,
    mailto: mailtoHref({
      email: v.email || "",
      subject,
      body: email_body
    })
  };
}
