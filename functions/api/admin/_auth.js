export function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    }
  });
}

export function options() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    }
  });
}

function getBearer(request) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

export function requireAdmin(request, env) {
  if (!env.ADMIN_PASSWORD) {
    return { ok: false, response: json({ ok: false, error: "ADMIN_PASSWORD not configured" }, 503) };
  }
  const token = getBearer(request);
  if (!token || token !== env.ADMIN_PASSWORD) {
    return { ok: false, response: json({ ok: false, error: "Unauthorized" }, 401) };
  }
  return { ok: true };
}
