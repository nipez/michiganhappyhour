const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}

function asText(value, max = 500) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, max);
}

function asInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function normalizeEvent(raw, request) {
  const cf = request.cf || {};
  const url = new URL(request.url);
  return {
    event_name: asText(raw.event_name || raw.cta || raw.event, 80),
    spot_id: asText(raw.spot_id, 120),
    spot_name: asText(raw.spot_name, 200),
    town: asText(raw.town, 120),
    page_type: asText(raw.page_type, 40),
    source: asText(raw.source, 60),
    path: asText(raw.path || url.pathname, 500),
    title: asText(raw.title, 300),
    referrer: asText(raw.referrer, 500),
    utm_source: asText(raw.utm_source, 120),
    utm_medium: asText(raw.utm_medium, 120),
    utm_campaign: asText(raw.utm_campaign, 120),
    utm_content: asText(raw.utm_content, 120),
    utm_term: asText(raw.utm_term, 120),
    visitor_id: asText(raw.visitor_id, 80),
    session_id: asText(raw.session_id, 80),
    language: asText(raw.language, 40),
    timezone: asText(raw.timezone, 80),
    screen_w: asInt(raw.screen_w),
    screen_h: asInt(raw.screen_h),
    viewport_w: asInt(raw.viewport_w),
    viewport_h: asInt(raw.viewport_h),
    user_agent: asText(raw.user_agent || request.headers.get("user-agent"), 400),
    country: asText(raw.country || cf.country, 8),
    city: asText(raw.city || cf.city, 80),
    region: asText(raw.region || cf.region || cf.regionCode, 80),
    colo: asText(raw.colo || cf.colo, 16),
    payload: raw.payload != null ? asText(typeof raw.payload === "string" ? raw.payload : JSON.stringify(raw.payload), 4000) : null
  };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) {
    return json({ ok: false, error: "DB binding missing" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const items = Array.isArray(body) ? body : Array.isArray(body.events) ? body.events : [body];
  if (!items.length) {
    return json({ ok: false, error: "No events" }, 400);
  }
  if (items.length > 25) {
    return json({ ok: false, error: "Max 25 events per request" }, 400);
  }

  const rows = items.map((item) => normalizeEvent(item || {}, request)).filter((row) => row.event_name);
  if (!rows.length) {
    return json({ ok: false, error: "event_name required" }, 400);
  }

  const stmt = env.DB.prepare(
    `INSERT INTO events (
      event_name, spot_id, spot_name, town, page_type, source, path, title, referrer,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      visitor_id, session_id, language, timezone,
      screen_w, screen_h, viewport_w, viewport_h, user_agent,
      country, city, region, colo, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  try {
    await env.DB.batch(
      rows.map((r) =>
        stmt.bind(
          r.event_name,
          r.spot_id,
          r.spot_name,
          r.town,
          r.page_type,
          r.source,
          r.path,
          r.title,
          r.referrer,
          r.utm_source,
          r.utm_medium,
          r.utm_campaign,
          r.utm_content,
          r.utm_term,
          r.visitor_id,
          r.session_id,
          r.language,
          r.timezone,
          r.screen_w,
          r.screen_h,
          r.viewport_w,
          r.viewport_h,
          r.user_agent,
          r.country,
          r.city,
          r.region,
          r.colo,
          r.payload
        )
      )
    );
  } catch (err) {
    return json({ ok: false, error: "Insert failed", detail: String(err && err.message ? err.message : err) }, 500);
  }

  return json({ ok: true, inserted: rows.length });
}
