/**
 * Monthly venue traffic aggregation for claimed listings.
 *
 * Reusable by admin reports and (later) claim outreach that shows each venue
 * its own numbers. All queries are bounded to a calendar month window and
 * never scan the full events table per venue.
 */

/** Events that have a real write path today (track.js / cta-track / spot PDP). */
export const TRACKED_METRICS = {
  views: "spot_view",
  calls: "cta_call",
  map_clicks: "cta_map",
  directions: "cta_directions",
  website_clicks: "cta_website"
};

export const EVENT_NAMES = Object.values(TRACKED_METRICS);

const CACHE_URL_PREFIX =
  "https://michiganhappyhour.internal/cache/venue-traffic-v1/";
/** Edge TTL for monthly report payloads (seconds). */
export const VENUE_TRAFFIC_TTL_SECONDS = 300;

/**
 * Parse YYYY-MM → { month, start, end, prevMonth, prevStart, label }.
 * Defaults to the last fully completed calendar month (UTC).
 */
export function resolveMonth(raw) {
  const now = new Date();
  let year;
  let mon; // 1-12

  const m = String(raw || "").trim().match(/^(\d{4})-(\d{2})$/);
  if (m) {
    year = Number(m[1]);
    mon = Number(m[2]);
    if (!Number.isFinite(year) || mon < 1 || mon > 12) {
      throw new Error("Invalid month; use YYYY-MM");
    }
  } else {
    // Last full calendar month in UTC
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    d.setUTCMonth(d.getUTCMonth() - 1);
    year = d.getUTCFullYear();
    mon = d.getUTCMonth() + 1;
  }

  const start = `${year}-${pad2(mon)}-01 00:00:00`;
  const nextY = mon === 12 ? year + 1 : year;
  const nextM = mon === 12 ? 1 : mon + 1;
  const end = `${nextY}-${pad2(nextM)}-01 00:00:00`;

  const prevY = mon === 1 ? year - 1 : year;
  const prevM = mon === 1 ? 12 : mon - 1;
  const prevStart = `${prevY}-${pad2(prevM)}-01 00:00:00`;
  const prevMonth = `${prevY}-${pad2(prevM)}`;
  const month = `${year}-${pad2(mon)}`;

  return {
    month,
    prevMonth,
    start,
    end,
    prevStart,
    label: monthLabel(year, mon),
    prevLabel: monthLabel(prevY, prevM)
  };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function monthLabel(year, mon) {
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ];
  return `${names[mon - 1]} ${year}`;
}

function emptyMetrics() {
  return {
    views: 0,
    calls: 0,
    map_clicks: 0,
    directions: 0,
    website_clicks: 0
  };
}

function delta(curr, prev) {
  return {
    views: curr.views - prev.views,
    calls: curr.calls - prev.calls,
    map_clicks: curr.map_clicks - prev.map_clicks,
    directions: curr.directions - prev.directions,
    website_clicks: curr.website_clicks - prev.website_clicks
  };
}

function nameKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

function townKey(town) {
  return String(town || "")
    .trim()
    .toLowerCase();
}

/**
 * Match event aggregation rows to a venue.
 * Prefer spot_id = venue.id when present; else name + town (town optional on events).
 */
function matchMetrics(venue, bySpotId, byNameTown, byName) {
  const idKey = String(venue.id);
  if (bySpotId.has(idKey)) return bySpotId.get(idKey);

  const nk = nameKey(venue.name);
  const tk = townKey(venue.town);
  const exact = byNameTown.get(`${nk}\0${tk}`);
  if (exact) return exact;

  // Events sometimes omit town — use name-only bucket only when unique
  const nameOnly = byName.get(nk);
  if (nameOnly && nameOnly._unique) return nameOnly.metrics;
  return emptyMetrics();
}

function accumulateRow(bucket, row) {
  const m = bucket || emptyMetrics();
  m.views += Number(row.views) || 0;
  m.calls += Number(row.calls) || 0;
  m.map_clicks += Number(row.map_clicks) || 0;
  m.directions += Number(row.directions) || 0;
  m.website_clicks += Number(row.website_clicks) || 0;
  return m;
}

/**
 * One bounded GROUP BY over events for [prevStart, end).
 * Returns maps keyed for matching to venues.
 */
async function loadEventBuckets(env, prevStart, end) {
  const placeholders = EVENT_NAMES.map(() => "?").join(",");
  const sql = `
    SELECT
      strftime('%Y-%m', created_at) AS ym,
      spot_id,
      spot_name,
      town,
      SUM(CASE WHEN event_name = 'spot_view' THEN 1 ELSE 0 END) AS views,
      SUM(CASE WHEN event_name = 'cta_call' THEN 1 ELSE 0 END) AS calls,
      SUM(CASE WHEN event_name = 'cta_map' THEN 1 ELSE 0 END) AS map_clicks,
      SUM(CASE WHEN event_name = 'cta_directions' THEN 1 ELSE 0 END) AS directions,
      SUM(CASE WHEN event_name = 'cta_website' THEN 1 ELSE 0 END) AS website_clicks
    FROM events
    WHERE created_at >= ?
      AND created_at < ?
      AND event_name IN (${placeholders})
      AND spot_name IS NOT NULL
      AND spot_name != ''
    GROUP BY ym, spot_id, spot_name, town
  `;

  const result = await env.DB.prepare(sql)
    .bind(prevStart, end, ...EVENT_NAMES)
    .all();

  /** @type {Map<string, Map<string, object>>} ym → spotId → metrics */
  const byMonthSpotId = new Map();
  /** @type {Map<string, Map<string, object>>} ym → name\\0town → metrics */
  const byMonthNameTown = new Map();
  /** @type {Map<string, Map<string, {metrics, _unique}>>} ym → name → aggregate */
  const byMonthName = new Map();

  function monthMaps(ym) {
    if (!byMonthSpotId.has(ym)) {
      byMonthSpotId.set(ym, new Map());
      byMonthNameTown.set(ym, new Map());
      byMonthName.set(ym, new Map());
    }
    return {
      byId: byMonthSpotId.get(ym),
      byNT: byMonthNameTown.get(ym),
      byN: byMonthName.get(ym)
    };
  }

  for (const row of result.results || []) {
    const ym = row.ym;
    if (!ym) continue;
    const { byId, byNT, byN } = monthMaps(ym);
    const metrics = {
      views: Number(row.views) || 0,
      calls: Number(row.calls) || 0,
      map_clicks: Number(row.map_clicks) || 0,
      directions: Number(row.directions) || 0,
      website_clicks: Number(row.website_clicks) || 0
    };

    const sid = row.spot_id != null ? String(row.spot_id).trim() : "";
    // Numeric venue ids only — slug ids from static pages are not stable keys
    if (/^\d+$/.test(sid)) {
      byId.set(sid, accumulateRow(byId.get(sid), metrics));
    }

    const nk = nameKey(row.spot_name);
    const tk = townKey(row.town);
    const ntKey = `${nk}\0${tk}`;
    byNT.set(ntKey, accumulateRow(byNT.get(ntKey), metrics));

    const existing = byN.get(nk);
    if (!existing) {
      byN.set(nk, { metrics: { ...metrics }, _unique: true, _town: tk });
    } else if (existing._town !== tk) {
      existing._unique = false;
      existing.metrics = accumulateRow(existing.metrics, metrics);
    } else {
      existing.metrics = accumulateRow(existing.metrics, metrics);
    }
  }

  return { byMonthSpotId, byMonthNameTown, byMonthName };
}

function listingPath(venue) {
  if (venue.spot_path) {
    const leaf = String(venue.spot_path).split("/").pop().replace(/\.html$/, "");
    return `/spots/${leaf}`;
  }
  return null;
}

/**
 * Build the monthly claimed-venue traffic report.
 * @param {object} env
 * @param {string} [monthRaw] YYYY-MM
 * @param {object} [opts]
 * @param {number} [opts.venueId] when set, return only that venue (must be claimed)
 * @param {boolean} [opts.skipCache]
 * @param {object} [opts.ctx] Pages context for waitUntil
 */
export async function buildClaimedVenueTrafficReport(env, monthRaw, opts = {}) {
  const bounds = resolveMonth(monthRaw);
  const venueId = opts.venueId != null ? Number(opts.venueId) : null;
  const cacheKey = `${bounds.month}${venueId ? `:v${venueId}` : ""}`;

  if (!opts.skipCache) {
    try {
      const cached = await caches.default.match(
        new Request(CACHE_URL_PREFIX + cacheKey, { method: "GET" })
      );
      if (cached) {
        const data = await cached.json();
        if (data && data.ok) return data;
      }
    } catch {
      /* local / unavailable */
    }
  }

  let venueSql = `
    SELECT id, name, town, region, region_name, featured, claimed, claimed_at,
           phone, website, spot_path, stripe_subscription_id
    FROM venues
    WHERE claimed = 1 AND status = 'published'
  `;
  const venueBinds = [];
  if (Number.isFinite(venueId) && venueId > 0) {
    venueSql += ` AND id = ?`;
    venueBinds.push(venueId);
  }
  venueSql += ` ORDER BY name COLLATE NOCASE ASC`;

  const venuesRes = venueBinds.length
    ? await env.DB.prepare(venueSql).bind(...venueBinds).all()
    : await env.DB.prepare(venueSql).all();
  const venues = venuesRes.results || [];

  const { byMonthSpotId, byMonthNameTown, byMonthName } = await loadEventBuckets(
    env,
    bounds.prevStart,
    bounds.end
  );

  const currId = byMonthSpotId.get(bounds.month) || new Map();
  const currNT = byMonthNameTown.get(bounds.month) || new Map();
  const currN = byMonthName.get(bounds.month) || new Map();
  const prevId = byMonthSpotId.get(bounds.prevMonth) || new Map();
  const prevNT = byMonthNameTown.get(bounds.prevMonth) || new Map();
  const prevN = byMonthName.get(bounds.prevMonth) || new Map();

  const rows = venues.map((v) => {
    const current = matchMetrics(v, currId, currNT, currN);
    const previous = matchMetrics(v, prevId, prevNT, prevN);
    return {
      venue_id: v.id,
      name: v.name,
      town: v.town,
      region: v.region,
      region_name: v.region_name,
      featured: Number(v.featured) || 0,
      claimed: 1,
      claimed_at: v.claimed_at || null,
      phone: v.phone || null,
      website: v.website || null,
      spot_path: v.spot_path || null,
      listing_path: listingPath(v),
      has_stripe: Boolean(v.stripe_subscription_id),
      metrics: current,
      previous_metrics: previous,
      change: delta(current, previous)
    };
  });

  const payload = {
    ok: true,
    month: bounds.month,
    month_label: bounds.label,
    prev_month: bounds.prevMonth,
    prev_month_label: bounds.prevLabel,
    range: { start: bounds.start, end: bounds.end },
    tracked_metrics: { ...TRACKED_METRICS },
    claimed_count: rows.length,
    venues: rows,
    cached_at: new Date().toISOString()
  };

  if (!opts.skipCache) {
    try {
      const response = new Response(JSON.stringify(payload), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `private, max-age=${VENUE_TRAFFIC_TTL_SECONDS}`
        }
      });
      const put = caches.default.put(
        new Request(CACHE_URL_PREFIX + cacheKey, { method: "GET" }),
        response.clone()
      );
      if (opts.ctx && typeof opts.ctx.waitUntil === "function") {
        opts.ctx.waitUntil(put);
      } else {
        await put;
      }
    } catch {
      /* ignore cache write failures */
    }
  }

  return payload;
}

/**
 * Single-venue slice (for printable report / outreach reuse).
 */
export async function getVenueMonthTraffic(env, venueId, monthRaw, opts = {}) {
  const report = await buildClaimedVenueTrafficReport(env, monthRaw, {
    ...opts,
    venueId
  });
  const venue = (report.venues || [])[0] || null;
  return {
    ...report,
    venue,
    venues: venue ? [venue] : []
  };
}

/** CSV for the claimed-venues monthly table. */
export function reportToCsv(report) {
  const headers = [
    "venue_id",
    "name",
    "town",
    "region",
    "featured",
    "month",
    "views",
    "views_prev",
    "views_change",
    "calls",
    "calls_prev",
    "calls_change",
    "map_clicks",
    "map_clicks_prev",
    "map_clicks_change",
    "directions",
    "directions_prev",
    "directions_change",
    "website_clicks",
    "website_clicks_prev",
    "website_clicks_change",
    "listing_path",
    "claimed_at"
  ];

  const lines = [headers.join(",")];
  for (const v of report.venues || []) {
    const m = v.metrics || emptyMetrics();
    const p = v.previous_metrics || emptyMetrics();
    const c = v.change || emptyMetrics();
    const row = [
      v.venue_id,
      csvEscape(v.name),
      csvEscape(v.town),
      csvEscape(v.region_name || v.region || ""),
      v.featured ? 1 : 0,
      report.month,
      m.views,
      p.views,
      c.views,
      m.calls,
      p.calls,
      c.calls,
      m.map_clicks,
      p.map_clicks,
      c.map_clicks,
      m.directions,
      p.directions,
      c.directions,
      m.website_clicks,
      p.website_clicks,
      c.website_clicks,
      csvEscape(v.listing_path || ""),
      csvEscape(v.claimed_at || "")
    ];
    lines.push(row.join(","));
  }
  return lines.join("\n") + "\n";
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
