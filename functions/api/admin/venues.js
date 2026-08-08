import { json, options, requireAdmin } from "./_auth.js";
import { toFullVenue, slugify } from "../_venues.js";

const REGION_META = {
  "traverse-city": { name: "Traverse City", color: "#E8614D" },
  leelanau: { name: "Leelanau Peninsula", color: "#0D9488" },
  "old-mission": { name: "Old Mission Peninsula", color: "#7C3AED" },
  "elk-rapids": { name: "Elk Rapids & Torch Lake", color: "#2563EB" },
  "frankfort-benzie": { name: "Frankfort & Benzie", color: "#0891B2" },
  "charlevoix-petoskey": { name: "Charlevoix & Petoskey", color: "#DB2777" },
  "bellaire-mancelona": { name: "Bellaire & Mancelona", color: "#65A30D" },
  mackinaw: { name: "Mackinaw & Mackinac", color: "#EA580C" },
  "grand-rapids": { name: "Grand Rapids", color: "#4F46E5" },
  "ann-arbor": { name: "Ann Arbor", color: "#CA8A04" },
  detroit: { name: "Detroit", color: "#DC2626" },
  kalamazoo: { name: "Kalamazoo", color: "#9333EA" },
  lansing: { name: "Lansing", color: "#16A34A" },
  holland: { name: "Holland", color: "#0284C7" },
  muskegon: { name: "Muskegon", color: "#0F766E" },
  marquette: { name: "Marquette", color: "#B45309" },
  "tri-cities": { name: "Saginaw/Bay City", color: "#BE123C" },
  flint: { name: "Flint", color: "#4338CA" },
  "port-huron": { name: "Port Huron & Thumb", color: "#0E7490" },
  jackson: { name: "Jackson", color: "#A16207" },
  "battle-creek": { name: "Battle Creek", color: "#B91C1C" },
  "southwest-mi": { name: "SW Michigan", color: "#047857" },
  "monroe-adrian": { name: "Monroe & Adrian", color: "#7C2D12" },
  "mount-pleasant": { name: "Mount Pleasant", color: "#1D4ED8" },
  cadillac: { name: "Cadillac", color: "#365314" },
  "west-shore": { name: "Ludington & Manistee", color: "#0369A1" },
  "northeast-mi": { name: "Northeast Michigan", color: "#6D28D9" },
  "up-west": { name: "Western UP", color: "#92400E" },
  "up-east": { name: "Eastern UP", color: "#1E3A5F" }
};

function normalizeDays(input) {
  if (Array.isArray(input)) return input.map(String);
  if (typeof input === "string") {
    const t = input.trim();
    if (!t) return [];
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* comma / newline list */
    }
    return t
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeDeals(input) {
  if (Array.isArray(input)) return input.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof input === "string") {
    return input
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeCollections(input) {
  if (Array.isArray(input)) return input.map(String);
  if (typeof input === "string") {
    const t = input.trim();
    if (!t) return [];
    try {
      const parsed = JSON.parse(t);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* ignore */
    }
    return t
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function coerceVenuePayload(body, { partial = false } = {}) {
  const out = {};
  const set = (key, val) => {
    if (val !== undefined) out[key] = val;
  };

  if (body.name !== undefined) set("name", String(body.name || "").trim());
  if (body.category !== undefined) set("category", String(body.category || "").trim() || null);
  if (body.region !== undefined) set("region", String(body.region || "").trim());
  if (body.region_name !== undefined) set("region_name", String(body.region_name || "").trim() || null);
  if (body.region_color !== undefined) set("region_color", String(body.region_color || "").trim() || null);
  if (body.town !== undefined) set("town", String(body.town || "").trim());
  if (body.address !== undefined) set("address", String(body.address || "").trim() || null);
  if (body.phone !== undefined) set("phone", String(body.phone || "").trim() || null);
  if (body.website !== undefined) set("website", String(body.website || "").trim() || null);
  if (body.opening_hours !== undefined)
    set("opening_hours", String(body.opening_hours || "").trim() || null);
  if (body.hh_start !== undefined) set("hh_start", String(body.hh_start || "").trim() || null);
  if (body.hh_end !== undefined) set("hh_end", String(body.hh_end || "").trim() || null);
  if (body.hh_days !== undefined) set("hh_days", JSON.stringify(normalizeDays(body.hh_days)));
  if (body.deals !== undefined) set("deals", JSON.stringify(normalizeDeals(body.deals)));
  if (body.vibe !== undefined) set("vibe", String(body.vibe || "").trim() || null);
  if (body.lat !== undefined) {
    const n = Number(body.lat);
    set("lat", Number.isFinite(n) ? n : null);
  }
  if (body.lng !== undefined) {
    const n = Number(body.lng);
    set("lng", Number.isFinite(n) ? n : null);
  }
  if (body.featured !== undefined) set("featured", body.featured ? 1 : 0);
  if (body.claimed !== undefined) {
    set("claimed", body.claimed ? 1 : 0);
    if (body.claimed) {
      set(
        "claimed_at",
        String(body.claimed_at || "").trim() || new Date().toISOString().slice(0, 10)
      );
    } else if (body.claimed_at !== undefined) {
      set("claimed_at", String(body.claimed_at || "").trim() || null);
    } else {
      set("claimed_at", null);
    }
  } else if (body.claimed_at !== undefined) {
    set("claimed_at", String(body.claimed_at || "").trim() || null);
  }
  if (body.collections !== undefined) set("collections", JSON.stringify(normalizeCollections(body.collections)));
  if (body.spot_path !== undefined) set("spot_path", String(body.spot_path || "").trim() || null);
  if (body.status !== undefined) set("status", String(body.status || "published").trim());
  if (body.admin_notes !== undefined) set("admin_notes", String(body.admin_notes || "").trim() || null);

  if (!partial) {
    if (!out.name || !out.town || !out.region) {
      return { error: "name, town, and region are required" };
    }
    const meta = REGION_META[out.region];
    if (!out.region_name) out.region_name = meta?.name || out.town;
    if (!out.region_color) out.region_color = meta?.color || "#E8614D";
    if (out.hh_days === undefined) out.hh_days = "[]";
    if (out.deals === undefined) out.deals = "[]";
    if (out.collections === undefined) out.collections = "[]";
    if (out.featured === undefined) out.featured = 0;
    if (out.claimed === undefined) out.claimed = 0;
    if (out.status === undefined) out.status = "published";
    if (!out.spot_path) {
      out.spot_path = `../spots/${slugify(out.name, out.town)}.html`;
    }
  } else {
    if (out.region) {
      const meta = REGION_META[out.region];
      if (body.region_name === undefined && meta) out.region_name = meta.name;
      if (body.region_color === undefined && meta) out.region_color = meta.color;
    }
    // Keep spot_path aligned when name+town are both updated and path wasn't set explicitly
    if (out.name && out.town && body.spot_path === undefined) {
      out.spot_path = `../spots/${slugify(out.name, out.town)}.html`;
    }
  }

  const allowedStatus = ["published", "draft", "archived"];
  if (out.status && !allowedStatus.includes(out.status)) {
    return { error: "invalid status", allowed: allowedStatus };
  }

  return { value: out };
}

export async function onRequestOptions() {
  return options();
}

/**
 * GET /api/admin/venues
 * Query: id=, q=, region=, status=, limit=
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: "DB binding missing" }, 500);
  const auth = requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const id = Number(url.searchParams.get("id") || "");
  const q = (url.searchParams.get("q") || "").trim();
  const region = (url.searchParams.get("region") || "").trim();
  const status = (url.searchParams.get("status") || "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 500) || 500, 1), 1000);

  try {
    if (Number.isFinite(id) && id > 0) {
      const row = await env.DB.prepare(`SELECT * FROM venues WHERE id = ?`).bind(id).first();
      if (!row) return json({ ok: false, error: "Not found" }, 404);
      return json({ ok: true, venue: toFullVenue(row), regions: REGION_META });
    }

    let sql = `SELECT * FROM venues WHERE 1=1`;
    const binds = [];
    if (status) {
      sql += ` AND status = ?`;
      binds.push(status);
    }
    if (region) {
      sql += ` AND region = ?`;
      binds.push(region);
    }
    if (q) {
      sql += ` AND (name LIKE ? OR town LIKE ? OR address LIKE ?)`;
      const like = `%${q}%`;
      binds.push(like, like, like);
    }
    sql += ` ORDER BY name COLLATE NOCASE ASC LIMIT ?`;
    binds.push(limit);

    const result = await env.DB.prepare(sql).bind(...binds).all();
    const counts = await env.DB.prepare(
      `SELECT status, COUNT(*) AS count FROM venues GROUP BY status`
    ).all();

    return json({
      ok: true,
      counts: counts.results || [],
      venues: (result.results || []).map(toFullVenue),
      regions: REGION_META
    });
  } catch (err) {
    return json(
      { ok: false, error: "Query failed", detail: String(err && err.message ? err.message : err) },
      500
    );
  }
}

/**
 * POST /api/admin/venues — create venue
 * PUT  /api/admin/venues — update venue { id, ...fields }
 */
export async function onRequestPost(context) {
  return upsert(context, { create: true });
}

export async function onRequestPut(context) {
  return upsert(context, { create: false });
}

async function upsert(context, { create }) {
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

  try {
    if (create) {
      const parsed = coerceVenuePayload(body, { partial: false });
      if (parsed.error) return json({ ok: false, error: parsed.error, allowed: parsed.allowed }, 400);
      const v = parsed.value;

      const max = await env.DB.prepare(`SELECT COALESCE(MAX(id), 0) AS m FROM venues`).first();
      const id = Number(body.id) > 0 ? Number(body.id) : Number(max?.m || 0) + 1;

      await env.DB.prepare(
        `INSERT INTO venues (
          id, name, category, region, region_name, region_color, town, address, phone, website,
          hh_start, hh_end, hh_days, deals, vibe, lat, lng, featured, claimed, claimed_at, collections,
          spot_path, status, admin_notes, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
        .bind(
          id,
          v.name,
          v.category,
          v.region,
          v.region_name,
          v.region_color,
          v.town,
          v.address,
          v.phone,
          v.website ?? null,
          v.hh_start,
          v.hh_end,
          v.hh_days,
          v.deals,
          v.vibe,
          v.lat,
          v.lng,
          v.featured,
          v.claimed ?? 0,
          v.claimed_at ?? null,
          v.collections,
          v.spot_path,
          v.status,
          v.admin_notes ?? null
        )
        .run();

      const row = await env.DB.prepare(`SELECT * FROM venues WHERE id = ?`).bind(id).first();
      return json({ ok: true, venue: toFullVenue(row) }, 201);
    }

    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return json({ ok: false, error: "id required for update" }, 400);
    }
    const parsed = coerceVenuePayload(body, { partial: true });
    if (parsed.error) return json({ ok: false, error: parsed.error, allowed: parsed.allowed }, 400);
    const v = parsed.value;
    const keys = Object.keys(v);
    if (!keys.length) return json({ ok: false, error: "No fields to update" }, 400);

    const sets = keys.map((k) => `${k} = ?`).join(", ");
    await env.DB.prepare(
      `UPDATE venues SET ${sets}, updated_at = datetime('now') WHERE id = ?`
    )
      .bind(...keys.map((k) => v[k]), id)
      .run();

    const row = await env.DB.prepare(`SELECT * FROM venues WHERE id = ?`).bind(id).first();
    if (!row) return json({ ok: false, error: "Not found" }, 404);
    return json({ ok: true, venue: toFullVenue(row) });
  } catch (err) {
    return json(
      { ok: false, error: create ? "Create failed" : "Update failed", detail: String(err && err.message ? err.message : err) },
      500
    );
  }
}
