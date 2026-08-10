import { slugify } from "../_venues.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};

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
  "up-east": { name: "Eastern UP", color: "#1E3A5F" },
  livingston: { name: "Brighton & Howell", color: "#C2410C" },
  "south-central": { name: "South Central Michigan", color: "#9F1239" },
  "west-central": { name: "West Central Michigan", color: "#115E59" }
};

const TOWN_REGION = {
  "traverse city": "traverse-city",
  "suttons bay": "leelanau",
  leland: "leelanau",
  "glen arbor": "leelanau",
  "old mission": "old-mission",
  "elk rapids": "elk-rapids",
  alden: "elk-rapids",
  frankfort: "frankfort-benzie",
  beulah: "frankfort-benzie",
  thompsonville: "frankfort-benzie",
  charlevoix: "charlevoix-petoskey",
  petoskey: "charlevoix-petoskey",
  bellaire: "bellaire-mancelona",
  mancelona: "bellaire-mancelona",
  "mackinaw city": "mackinaw",
  "mackinac island": "mackinaw",
  "grand rapids": "grand-rapids",
  "ann arbor": "ann-arbor",
  ypsilanti: "ann-arbor",
  detroit: "detroit",
  ferndale: "detroit",
  royal: "detroit",
  "royal oak": "detroit",
  hamtramck: "detroit",
  kalamazoo: "kalamazoo",
  lansing: "lansing",
  "east lansing": "lansing",
  holland: "holland",
  zeeland: "holland",
  muskegon: "muskegon",
  "norton shores": "muskegon",
  marquette: "marquette",
  saginaw: "tri-cities",
  "bay city": "tri-cities",
  midland: "tri-cities",
  flint: "flint",
  "port huron": "port-huron",
  marysville: "port-huron",
  "bad axe": "port-huron",
  jackson: "jackson",
  "battle creek": "battle-creek",
  "benton harbor": "southwest-mi",
  "st joseph": "southwest-mi",
  "st. joseph": "southwest-mi",
  niles: "southwest-mi",
  monroe: "monroe-adrian",
  adrian: "monroe-adrian",
  "mount pleasant": "mount-pleasant",
  "mt pleasant": "mount-pleasant",
  cadillac: "cadillac",
  ludington: "west-shore",
  manistee: "west-shore",
  alpena: "northeast-mi",
  gaylord: "northeast-mi",
  grayling: "northeast-mi",
  houghton: "up-west",
  hancock: "up-west",
  "iron mountain": "up-west",
  "sault ste marie": "up-east",
  "sault ste. marie": "up-east",
  escanaba: "up-east",
  brighton: "livingston",
  howell: "livingston",
  coldwater: "south-central",
  hillsdale: "south-central",
  sturgis: "south-central",
  "three rivers": "south-central",
  marshall: "south-central",
  albion: "south-central",
  "big rapids": "west-central",
  clare: "west-central",
  fremont: "west-central",
  newaygo: "west-central",
  "grand haven": "muskegon",
  "spring lake": "muskegon",
  whitehall: "muskegon",
  saugatuck: "holland",
  douglas: "holland",
  "south haven": "holland",
  "new buffalo": "southwest-mi",
  cheboygan: "mackinaw",
  oscoda: "northeast-mi",
  "tawas city": "northeast-mi",
  tawas: "northeast-mi",
  "rogers city": "northeast-mi",
  munising: "up-east",
  manistique: "up-east",
  newberry: "up-east",
  ishpeming: "marquette",
  ironwood: "up-west",
  "iron river": "up-west",
  owosso: "lansing",
  alma: "mount-pleasant",
  lapeer: "flint",
  ionia: "grand-rapids",
  hastings: "grand-rapids",
  charlotte: "lansing",
  novi: "detroit",
  plymouth: "detroit",
  canton: "detroit"
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

function guessRegion(town, hint) {
  const h = String(hint || "").trim().toLowerCase();
  if (h && REGION_META[h]) return h;
  const t = String(town || "").trim().toLowerCase();
  if (TOWN_REGION[t]) return TOWN_REGION[t];
  for (const [key, region] of Object.entries(TOWN_REGION)) {
    if (t.includes(key) || key.includes(t)) return region;
  }
  return "traverse-city";
}

function parseSchedule(raw) {
  const text = String(raw || "").trim();
  if (!text) return { hh_start: null, hh_end: null, hh_days: [] };

  const timeRe =
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*[-–—to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i;
  const m = text.match(timeRe);
  let hh_start = null;
  let hh_end = null;
  if (m) {
    hh_start = normalizeClock(m[1]);
    hh_end = normalizeClock(m[2]);
  }

  const days = [];
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ];
  for (const d of dayNames) {
    if (new RegExp(`\\b${d}\\b`, "i").test(text)) days.push(d);
  }
  if (/\b(every\s*day|daily|7\s*days)\b/i.test(text)) {
    return { hh_start, hh_end, hh_days: dayNames };
  }
  if (/\bmon\s*[-–—]\s*fri\b/i.test(text) || /\bweekdays?\b/i.test(text)) {
    return {
      hh_start,
      hh_end,
      hh_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    };
  }
  return { hh_start, hh_end, hh_days: days };
}

function normalizeClock(token) {
  const t = String(token || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (!m) return String(token).trim();
  let h = Number(m[1]);
  const min = m[2] || "00";
  const ap = m[3].toUpperCase();
  const h12 = h % 12 || 12;
  return `${h12}:${min} ${ap}`;
}

function parseDeals(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];
  return text
    .split(/[\n;|]+/)
    .map((s) => s.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
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
  const type = (url.searchParams.get("type") || "").trim();
  const includeArchived = url.searchParams.get("include_archived") === "1";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50) || 50, 1), 200);

  try {
    const clauses = [];
    const binds = [];
    if (status) {
      clauses.push("status = ?");
      binds.push(status);
    } else if (!includeArchived) {
      // Default inbox hides archived test/junk submissions
      clauses.push("status != 'archived'");
    }
    if (type) {
      clauses.push("submission_type = ?");
      binds.push(type);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = await env.DB.prepare(
      `SELECT * FROM submissions ${where} ORDER BY id DESC LIMIT ?`
    )
      .bind(...binds, limit)
      .all();

    const counts = await env.DB.prepare(
      `SELECT status, COUNT(*) AS count FROM submissions GROUP BY status`
    ).all();
    const typeCounts = await env.DB.prepare(
      `SELECT submission_type, COUNT(*) AS count FROM submissions GROUP BY submission_type`
    ).all();

    return json({
      ok: true,
      counts: counts.results || [],
      type_counts: typeCounts.results || [],
      submissions: rows.results || []
    });
  } catch (err) {
    return json({ ok: false, error: "Query failed", detail: String(err && err.message ? err.message : err) }, 500);
  }
}

/**
 * POST /api/admin/submissions
 * Body:
 *   { id, status }  status = new | reviewed | published | rejected | archived
 *   { id, action: "publish_venue", region? }  → upsert into venues + mark published
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
  if (!Number.isFinite(id)) {
    return json({ ok: false, error: "id required" }, 400);
  }

  const action = String(body.action || "").trim();
  if (action === "publish_venue") {
    return publishSubmissionToVenue(env, id, body);
  }

  const status = String(body.status || "").trim();
  const allowed = ["new", "reviewed", "published", "rejected", "archived"];
  if (!allowed.includes(status)) {
    return json({ ok: false, error: "id and valid status required", allowed }, 400);
  }

  try {
    await env.DB.prepare(`UPDATE submissions SET status = ? WHERE id = ?`).bind(status, id).run();
    return json({ ok: true, id, status });
  } catch (err) {
    return json({ ok: false, error: "Update failed", detail: String(err && err.message ? err.message : err) }, 500);
  }
}

async function publishSubmissionToVenue(env, id, body) {
  const sub = await env.DB.prepare(`SELECT * FROM submissions WHERE id = ?`).bind(id).first();
  if (!sub) return json({ ok: false, error: "Submission not found" }, 404);

  const name = String(sub.name || "").trim();
  const town = String(sub.town || "").trim();
  if (!name || !town) {
    return json({ ok: false, error: "Submission missing name or town" }, 400);
  }

  const region = guessRegion(town, body.region || sub.region);
  const meta = REGION_META[region] || { name: town, color: "#E8614D" };
  const schedule = parseSchedule(sub.happy_hour_schedule);
  const deals = parseDeals(sub.deals);
  const vibe = String(sub.vibe || "").trim() || null;
  const phone = String(sub.phone || "").trim() || null;
  const website = String(sub.website || "").trim() || null;
  const address = String(sub.address || "").trim() || null;
  const category = String(sub.category || "").trim() || "Restaurant";
  const spot_path = `../spots/${slugify(name, town)}.html`;
  const hh_days = JSON.stringify(
    schedule.hh_days.length
      ? schedule.hh_days
      : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  );
  const dealsJson = JSON.stringify(
    deals.length ? deals : ["Ask about today's drink & food specials"]
  );

  try {
    const existing = await env.DB.prepare(
      `SELECT id FROM venues
       WHERE lower(name) = lower(?) AND lower(town) = lower(?)
       ORDER BY CASE status WHEN 'published' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, id
       LIMIT 1`
    )
      .bind(name, town)
      .first();

    let venueId;
    let created = false;

    const isClaim = String(sub.submission_type || "") === "claim_request";
    const claimNote = isClaim
      ? `\nClaimed from submission #${id}`
      : `\nPublished from submission #${id}`;

    if (existing?.id) {
      venueId = existing.id;
      await env.DB.prepare(
        `UPDATE venues SET
          category = COALESCE(?, category),
          region = ?,
          region_name = ?,
          region_color = ?,
          address = COALESCE(?, address),
          phone = COALESCE(?, phone),
          website = COALESCE(?, website),
          hh_start = COALESCE(?, hh_start),
          hh_end = COALESCE(?, hh_end),
          hh_days = ?,
          deals = ?,
          vibe = COALESCE(?, vibe),
          spot_path = COALESCE(spot_path, ?),
          status = 'published',
          claimed = CASE WHEN ? = 1 THEN 1 ELSE claimed END,
          claimed_at = CASE WHEN ? = 1 THEN COALESCE(claimed_at, date('now')) ELSE claimed_at END,
          source = CASE WHEN source IS NULL OR source = '' THEN 'curated' ELSE source END,
          last_verified_at = date('now'),
          admin_notes = TRIM(COALESCE(admin_notes,'') || ?),
          updated_at = datetime('now')
         WHERE id = ?`
      )
        .bind(
          category,
          region,
          meta.name,
          meta.color,
          address,
          phone,
          website,
          schedule.hh_start,
          schedule.hh_end,
          hh_days,
          dealsJson,
          vibe,
          spot_path,
          isClaim ? 1 : 0,
          isClaim ? 1 : 0,
          claimNote,
          venueId
        )
        .run();
    } else {
      const max = await env.DB.prepare(`SELECT COALESCE(MAX(id), 0) AS m FROM venues`).first();
      venueId = Number(max?.m || 0) + 1;
      created = true;
      await env.DB.prepare(
        `INSERT INTO venues (
          id, name, category, region, region_name, region_color, town, address, phone, website,
          hh_start, hh_end, hh_days, deals, vibe, featured, claimed, claimed_at, collections, spot_path, status,
          source, last_verified_at, admin_notes, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, '[]', ?, 'published', 'curated', date('now'), ?, datetime('now'))`
      )
        .bind(
          venueId,
          name,
          category,
          region,
          meta.name,
          meta.color,
          town,
          address,
          phone,
          website,
          schedule.hh_start,
          schedule.hh_end,
          hh_days,
          dealsJson,
          vibe,
          isClaim ? 1 : 0,
          isClaim ? new Date().toISOString().slice(0, 10) : null,
          spot_path,
          claimNote
        )
        .run();
    }

    await env.DB.prepare(`UPDATE submissions SET status = 'published' WHERE id = ?`).bind(id).run();

    const venue = await env.DB.prepare(`SELECT * FROM venues WHERE id = ?`).bind(venueId).first();
    return json({
      ok: true,
      id,
      status: "published",
      venue_id: venueId,
      created,
      spot_path: venue?.spot_path || spot_path,
      region
    });
  } catch (err) {
    return json(
      {
        ok: false,
        error: "Publish to venue failed",
        detail: String(err && err.message ? err.message : err)
      },
      500
    );
  }
}
