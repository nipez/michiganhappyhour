const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}

function unauthorized() {
  return json({ ok: false, error: "Unauthorized" }, 401);
}

function getBearer(request) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function checkAuth(request, env) {
  if (!env.ADMIN_PASSWORD) return { ok: false, reason: "ADMIN_PASSWORD not configured" };
  const token = getBearer(request);
  if (!token || token !== env.ADMIN_PASSWORD) return { ok: false, reason: "bad_token" };
  return { ok: true };
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * GET /api/admin/submissions
 * Authorization: Bearer <ADMIN_PASSWORD>
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: "DB binding missing" }, 500);

  const auth = checkAuth(request, env);
  if (!auth.ok) {
    if (auth.reason === "ADMIN_PASSWORD not configured") {
      return json({ ok: false, error: auth.reason }, 503);
    }
    return unauthorized();
  }

  const url = new URL(request.url);
  const status = (url.searchParams.get("status") || "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50) || 50, 1), 200);

  try {
    let rows;
    if (status) {
      rows = await env.DB.prepare(
        `SELECT * FROM submissions WHERE status = ? ORDER BY id DESC LIMIT ?`
      )
        .bind(status, limit)
        .all();
    } else {
      rows = await env.DB.prepare(`SELECT * FROM submissions ORDER BY id DESC LIMIT ?`)
        .bind(limit)
        .all();
    }

    const counts = await env.DB.prepare(
      `SELECT status, COUNT(*) AS count FROM submissions GROUP BY status`
    ).all();

    return json({
      ok: true,
      counts: counts.results || [],
      submissions: rows.results || []
    });
  } catch (err) {
    return json({ ok: false, error: "Query failed", detail: String(err && err.message ? err.message : err) }, 500);
  }
}

/**
 * POST /api/admin/submissions
 * Body: { id, status }  status = new | reviewed | published | rejected
 * Authorization: Bearer <ADMIN_PASSWORD>
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: "DB binding missing" }, 500);

  const auth = checkAuth(request, env);
  if (!auth.ok) {
    if (auth.reason === "ADMIN_PASSWORD not configured") {
      return json({ ok: false, error: auth.reason }, 503);
    }
    return unauthorized();
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const id = Number(body.id);
  const status = String(body.status || "").trim();
  const allowed = ["new", "reviewed", "published", "rejected"];
  if (!Number.isFinite(id) || !allowed.includes(status)) {
    return json({ ok: false, error: "id and valid status required", allowed }, 400);
  }

  try {
    await env.DB.prepare(`UPDATE submissions SET status = ? WHERE id = ?`).bind(status, id).run();
    return json({ ok: true, id, status });
  } catch (err) {
    return json({ ok: false, error: "Update failed", detail: String(err && err.message ? err.message : err) }, 500);
  }
}
