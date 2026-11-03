import { json, options, requireAdmin } from "./_auth.js";
import { invalidateSponsorsCache, isSponsorLive, toDateOnly } from "../../lib/sponsors-cache.js";

export function onRequestOptions() {
  return options();
}

function asText(v, max = 500) {
  if (v == null) return "";
  return String(v).trim().slice(0, max);
}

function asBoolInt(v, fallback = 1) {
  if (v === undefined || v === null || v === "") return fallback;
  if (v === true || v === 1 || v === "1" || v === "true") return 1;
  return 0;
}

function normalizeSlug(s) {
  return asText(s, 120)
    .toLowerCase()
    .replace(/\.html$/i, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function coerceSponsor(body, { partial = false } = {}) {
  const out = {};
  const set = (k, v) => {
    if (v !== undefined) out[k] = v;
  };

  if (body.place_type !== undefined || !partial) {
    const t = asText(body.place_type, 20).toLowerCase();
    if (t !== "town" && t !== "region") {
      return { error: "place_type must be town or region" };
    }
    set("place_type", t);
  }
  if (body.place_slug !== undefined || !partial) {
    const slug = normalizeSlug(body.place_slug);
    if (!slug) return { error: "place_slug required" };
    set("place_slug", slug);
  }
  if (body.name !== undefined || !partial) {
    const name = asText(body.name, 200);
    if (!name) return { error: "name required" };
    set("name", name);
  }
  if (body.url !== undefined || !partial) {
    const url = asText(body.url, 500);
    if (!url) return { error: "url required" };
    set("url", url);
  }
  if (body.tagline !== undefined) set("tagline", asText(body.tagline, 240) || null);
  if (body.image_url !== undefined) set("image_url", asText(body.image_url, 500) || null);
  if (body.starts_at !== undefined || !partial) {
    const starts = toDateOnly(body.starts_at);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(starts)) return { error: "starts_at must be YYYY-MM-DD" };
    set("starts_at", starts);
  }
  if (body.ends_at !== undefined || !partial) {
    const ends = toDateOnly(body.ends_at);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ends)) return { error: "ends_at must be YYYY-MM-DD" };
    set("ends_at", ends);
  }
  if (body.active !== undefined) set("active", asBoolInt(body.active, 1));
  else if (!partial) set("active", 1);

  if (out.starts_at && out.ends_at && out.starts_at > out.ends_at) {
    return { error: "starts_at must be on or before ends_at" };
  }

  return { value: out };
}

function toSponsor(row) {
  if (!row) return null;
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: row.id,
    place_type: row.place_type,
    place_slug: row.place_slug,
    name: row.name,
    url: row.url,
    tagline: row.tagline || "",
    image_url: row.image_url || "",
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    active: !!row.active,
    live: isSponsorLive(row, today),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * GET /api/admin/sponsors — list sponsors (optional ?place_type=&place_slug=&live=1)
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: "DB binding missing" }, 500);
  const auth = requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const placeType = asText(url.searchParams.get("place_type"), 20).toLowerCase();
  const placeSlug = normalizeSlug(url.searchParams.get("place_slug") || "");
  const liveOnly = url.searchParams.get("live") === "1";

  try {
    let sql = `SELECT * FROM sponsors WHERE 1=1`;
    const binds = [];
    if (placeType === "town" || placeType === "region") {
      sql += ` AND place_type = ?`;
      binds.push(placeType);
    }
    if (placeSlug) {
      sql += ` AND place_slug = ?`;
      binds.push(placeSlug);
    }
    sql += ` ORDER BY active DESC, ends_at DESC, id DESC LIMIT 200`;

    const result = await env.DB.prepare(sql).bind(...binds).all();
    let sponsors = (result.results || []).map(toSponsor);
    if (liveOnly) sponsors = sponsors.filter((s) => s.live);

    return json({ ok: true, sponsors, today: new Date().toISOString().slice(0, 10) });
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (msg.includes("no such table")) {
      return json(
        { ok: false, error: "Sponsors table missing — apply migration 0011_sponsors.sql" },
        503
      );
    }
    return json({ ok: false, error: "Query failed", detail: msg }, 500);
  }
}

/**
 * POST /api/admin/sponsors — create
 * PUT  /api/admin/sponsors — update { id, ... } or { id, end: true } to end today
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
    if (!create && body.end === true) {
      const id = Number(body.id);
      if (!Number.isFinite(id) || id <= 0) return json({ ok: false, error: "id required" }, 400);
      const today = new Date().toISOString().slice(0, 10);
      // End exclusive run: deactivate and clamp ends_at to yesterday (or today-1).
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      await env.DB.prepare(
        `UPDATE sponsors
         SET active = 0,
             ends_at = CASE WHEN ends_at > ? THEN ? ELSE ends_at END,
             updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(today, yesterday, id)
        .run();
      const row = await env.DB.prepare(`SELECT * FROM sponsors WHERE id = ?`).bind(id).first();
      if (!row) return json({ ok: false, error: "Not found" }, 404);
      invalidateSponsorsCache(context);
      return json({ ok: true, sponsor: toSponsor(row) });
    }

    if (create) {
      const parsed = coerceSponsor(body, { partial: false });
      if (parsed.error) return json({ ok: false, error: parsed.error }, 400);
      const v = parsed.value;

      const result = await env.DB.prepare(
        `INSERT INTO sponsors (
          place_type, place_slug, name, url, tagline, image_url,
          starts_at, ends_at, active, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
        .bind(
          v.place_type,
          v.place_slug,
          v.name,
          v.url,
          v.tagline ?? null,
          v.image_url ?? null,
          v.starts_at,
          v.ends_at,
          v.active ?? 1
        )
        .run();

      const id = result.meta?.last_row_id;
      const row = await env.DB.prepare(`SELECT * FROM sponsors WHERE id = ?`).bind(id).first();
      invalidateSponsorsCache(context);
      return json({ ok: true, sponsor: toSponsor(row) }, 201);
    }

    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return json({ ok: false, error: "id required for update" }, 400);
    }
    const parsed = coerceSponsor(body, { partial: true });
    if (parsed.error) return json({ ok: false, error: parsed.error }, 400);
    const v = parsed.value;
    const keys = Object.keys(v);
    if (!keys.length) return json({ ok: false, error: "No fields to update" }, 400);

    // If dates only partially provided, validate against existing row.
    if ((v.starts_at && !v.ends_at) || (v.ends_at && !v.starts_at)) {
      const existing = await env.DB.prepare(`SELECT starts_at, ends_at FROM sponsors WHERE id = ?`)
        .bind(id)
        .first();
      if (!existing) return json({ ok: false, error: "Not found" }, 404);
      const start = v.starts_at || toDateOnly(existing.starts_at);
      const end = v.ends_at || toDateOnly(existing.ends_at);
      if (start > end) return json({ ok: false, error: "starts_at must be on or before ends_at" }, 400);
    }

    const sets = keys.map((k) => `${k} = ?`).join(", ");
    await env.DB.prepare(
      `UPDATE sponsors SET ${sets}, updated_at = datetime('now') WHERE id = ?`
    )
      .bind(...keys.map((k) => v[k]), id)
      .run();

    const row = await env.DB.prepare(`SELECT * FROM sponsors WHERE id = ?`).bind(id).first();
    if (!row) return json({ ok: false, error: "Not found" }, 404);
    invalidateSponsorsCache(context);
    return json({ ok: true, sponsor: toSponsor(row) });
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (msg.includes("no such table")) {
      return json(
        { ok: false, error: "Sponsors table missing — apply migration 0011_sponsors.sql" },
        503
      );
    }
    return json(
      {
        ok: false,
        error: create ? "Create failed" : "Update failed",
        detail: msg
      },
      500
    );
  }
}
