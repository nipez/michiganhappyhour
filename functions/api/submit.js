const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, status === 200 ? 2 : 0), {
    status,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}

function asText(value, max = 2000) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, max);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * GET /api/submit — recent submissions (testing helper).
 * GET /api/submit?limit=50
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: "DB binding missing" }, 500);

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 25) || 25, 1), 100);

  try {
    const countRow = await env.DB.prepare(`SELECT COUNT(*) AS total FROM submissions`).first();
    const recent = await env.DB.prepare(
      `SELECT id, created_at, status, submission_type, name, town, category,
              happy_hour_schedule, deals, contact_name, email, phone, source
       FROM submissions
       ORDER BY id DESC
       LIMIT ?`
    )
      .bind(limit)
      .all();

    return json({
      ok: true,
      total_submissions: countRow?.total ?? 0,
      recent: recent.results || []
    });
  } catch (err) {
    return json({ ok: false, error: "Query failed", detail: String(err && err.message ? err.message : err) }, 500);
  }
}

/**
 * POST /api/submit — store a listing submission in D1.
 * Accepts JSON or form-urlencoded / multipart form data.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: "DB binding missing" }, 500);

  let raw = {};
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      raw = await request.json();
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const form = await request.formData();
      raw = Object.fromEntries(form.entries());
    } else {
      // Best-effort JSON parse
      raw = await request.json();
    }
  } catch {
    return json({ ok: false, error: "Invalid request body" }, 400);
  }

  // Honeypot — bots fill this; humans never see it.
  if (asText(raw.website_url || raw.company || raw._gotcha, 200)) {
    return json({ ok: true, id: 0, ignored: true });
  }

  const name = asText(raw.name, 200);
  const town = asText(raw.town, 120);
  const happyHour = asText(raw.happy_hour_schedule || raw.hh || raw.hours, 2000);
  const deals = asText(raw.deals, 4000);
  const email = asText(raw.email, 200);

  if (!name || !town || !happyHour || !deals || !email) {
    return json(
      {
        ok: false,
        error: "Missing required fields",
        required: ["name", "town", "happy_hour_schedule", "deals", "email"]
      },
      400
    );
  }

  const cf = request.cf || {};
  const submissionType =
    asText(raw.submission_type || raw.type, 40) ||
    (asText(raw._subject, 200) && String(raw._subject).toLowerCase().includes("update")
      ? "update"
      : "new_listing");

  const row = {
    status: "new",
    submission_type: submissionType,
    name,
    town,
    state: asText(raw.state, 40) || "Michigan",
    address: asText(raw.address || raw.addr, 300),
    category: asText(raw.category, 80),
    happy_hour_schedule: happyHour,
    deals,
    vibe: asText(raw.vibe, 2000),
    contact_name: asText(raw.contact_name, 160),
    role: asText(raw.role, 120),
    email,
    phone: asText(raw.phone, 60),
    website: asText(raw.website, 300),
    has_patio: asText(raw.has_patio || raw.patio, 20),
    notes: asText(raw.notes, 4000),
    source: asText(raw.source, 60) || "submit_page",
    path: asText(raw.path, 500) || new URL(request.url).pathname,
    referrer: asText(raw.referrer || request.headers.get("referer"), 500),
    visitor_id: asText(raw.visitor_id, 80),
    user_agent: asText(raw.user_agent || request.headers.get("user-agent"), 400),
    country: asText(cf.country, 8),
    city: asText(cf.city, 80),
    region: asText(cf.region || cf.regionCode, 80),
    colo: asText(cf.colo, 16),
    payload: asText(JSON.stringify(raw), 8000)
  };

  try {
    const result = await env.DB.prepare(
      `INSERT INTO submissions (
        status, submission_type, name, town, state, address, category,
        happy_hour_schedule, deals, vibe, contact_name, role, email, phone,
        website, has_patio, notes, source, path, referrer, visitor_id,
        user_agent, country, city, region, colo, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        row.status,
        row.submission_type,
        row.name,
        row.town,
        row.state,
        row.address,
        row.category,
        row.happy_hour_schedule,
        row.deals,
        row.vibe,
        row.contact_name,
        row.role,
        row.email,
        row.phone,
        row.website,
        row.has_patio,
        row.notes,
        row.source,
        row.path,
        row.referrer,
        row.visitor_id,
        row.user_agent,
        row.country,
        row.city,
        row.region,
        row.colo,
        row.payload
      )
      .run();

    // Also log an analytics event for funnel tracking.
    try {
      await env.DB.prepare(
        `INSERT INTO events (
          event_name, spot_name, town, page_type, source, path,
          visitor_id, user_agent, country, city, region, colo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          "submit_success",
          row.name,
          row.town,
          "submit",
          row.source,
          row.path,
          row.visitor_id,
          row.user_agent,
          row.country,
          row.city,
          row.region,
          row.colo
        )
        .run();
    } catch {
      // Non-fatal if events insert fails
    }

    return json({ ok: true, id: result.meta?.last_row_id ?? null });
  } catch (err) {
    return json({ ok: false, error: "Insert failed", detail: String(err && err.message ? err.message : err) }, 500);
  }
}
