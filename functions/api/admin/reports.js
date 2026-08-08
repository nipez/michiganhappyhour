import { json, options, requireAdmin } from "./_auth.js";
import { publicSpotHref, slugify } from "../_venues.js";

const CTA_EVENTS = [
  "cta_call",
  "cta_map",
  "cta_directions",
  "cta_details",
  "cta_website",
  "cta_claim",
  "spot_view",
  "page_view",
  "submit_success"
];

const PRIORITY_REGIONS = [
  "detroit",
  "grand-rapids",
  "ann-arbor",
  "traverse-city",
  "lansing",
  "kalamazoo",
  "holland",
  "muskegon",
  "marquette",
  "flint"
];

function clampDays(raw) {
  const n = Number(raw || 30);
  if (!Number.isFinite(n)) return 30;
  return Math.min(Math.max(Math.trunc(n), 1), 365);
}

function emptyCounts() {
  return {
    spot_view: 0,
    cta_call: 0,
    cta_map: 0,
    cta_directions: 0,
    cta_details: 0,
    cta_website: 0,
    cta_claim: 0,
    page_view: 0,
    submit_success: 0,
    other: 0,
    total_cta: 0,
    total_events: 0
  };
}

function accumulate(counts, eventName, n) {
  const c = Number(n) || 0;
  counts.total_events += c;
  if (
    Object.prototype.hasOwnProperty.call(counts, eventName) &&
    eventName !== "total_cta" &&
    eventName !== "total_events" &&
    eventName !== "other"
  ) {
    counts[eventName] += c;
  } else {
    counts.other += c;
  }
  if (
    eventName === "cta_call" ||
    eventName === "cta_map" ||
    eventName === "cta_directions" ||
    eventName === "cta_details" ||
    eventName === "cta_website" ||
    eventName === "cta_claim"
  ) {
    counts.total_cta += c;
  }
}

function claimUrl(name, town) {
  const params = new URLSearchParams({
    name: name || "",
    town: town || "",
    interest: "featured"
  });
  return `https://michiganhappyhour.com/for-business/?${params.toString()}#claim`;
}

function spotUrl(name, town, spotPath) {
  if (spotPath) {
    const href = publicSpotHref(spotPath);
    if (href && href !== "#") return `https://michiganhappyhour.com${href}`;
  }
  return `https://michiganhappyhour.com/spots/${slugify(name, town)}`;
}

function buildSummary({ spot, town, days, counts, venue }) {
  const place = town ? `${spot} (${town})` : spot;
  const listing = spotUrl(spot, town, venue?.spot_path);
  const claim = claimUrl(spot, town);
  const lines = [
    `${place} — Michigan Happy Hour report`,
    `Period: last ${days} days`,
    "",
    `Spot page views: ${counts.spot_view}`,
    `Call taps: ${counts.cta_call}`,
    `Map taps: ${counts.cta_map}`,
    `Directions taps: ${counts.cta_directions}`,
    `Details taps: ${counts.cta_details}`,
    `Website taps: ${counts.cta_website}`,
    `Claim taps: ${counts.cta_claim}`,
    `Total CTA taps: ${counts.total_cta}`,
    "",
    `Listing: ${listing}`,
    "Source: michiganhappyhour.com",
    "",
    "Featured placement: $79/mo (priority in your region + homepage/map callouts + monthly CTA stats).",
    `Claim / feature: ${claim}`
  ];
  return lines.join("\n");
}

function buildPitch({ spot, town, days, counts, venue }) {
  const listing = spotUrl(spot, town, venue?.spot_path);
  const claim = claimUrl(spot, town);
  const phone = venue?.phone ? `\nPhone on file: ${venue.phone}` : "";
  const views = counts?.spot_view || 0;
  const ctas = counts?.total_cta || 0;
  const proof =
    views || ctas
      ? `Over the last ${days} days your listing drew ${views} spot views and ${ctas} call/map/directions taps from people already searching Michigan happy hours.`
      : `Your spot is listed where locals and visitors already filter happy hours by day, region, and “live now.”`;

  return [
    `Hi — quick note from Michigan Happy Hour (michiganhappyhour.com).`,
    "",
    `I'm reaching out about ${spot}${town ? ` in ${town}` : ""}.`,
    proof,
    "",
    `Listing: ${listing}`,
    "",
    `Two options:`,
    `1) Claim the listing (free) — keep hours/deals accurate + monthly Call/Directions stats`,
    `2) Featured placement — $79/mo for priority in your region, homepage/map callouts, and everything in Claimed`,
    "",
    `Request here (takes 1 minute): ${claim}`,
    "",
    `Happy to send last month's numbers or answer questions.`,
    `— Michigan Happy Hour`,
    phone
  ]
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();
}

async function lookupVenue(env, name, town) {
  if (!name) return null;
  if (town) {
    const exact = await env.DB.prepare(
      `SELECT id, name, town, region, phone, website, featured, spot_path, source, status
       FROM venues
       WHERE status = 'published' AND lower(name) = lower(?) AND lower(town) = lower(?)
       LIMIT 1`
    )
      .bind(name, town)
      .first();
    if (exact) return exact;
  }
  return env.DB.prepare(
    `SELECT id, name, town, region, phone, website, featured, spot_path, source, status
     FROM venues
     WHERE status = 'published' AND lower(name) = lower(?)
     ORDER BY CASE WHEN ? != '' AND lower(town) = lower(?) THEN 0 ELSE 1 END
     LIMIT 1`
  )
    .bind(name, town || "", town || "")
    .first();
}

async function enrichRows(env, rows) {
  const out = [];
  for (const r of rows || []) {
    const venue = await lookupVenue(env, r.spot_name || r.name, r.town);
    out.push({
      ...r,
      venue_id: venue?.id || null,
      region: venue?.region || null,
      phone: venue?.phone || null,
      website: venue?.website || null,
      featured: venue ? Number(venue.featured) || 0 : 0,
      source: venue?.source || null,
      spot_path: venue?.spot_path || null,
      listing_url: spotUrl(r.spot_name || r.name, r.town || venue?.town, venue?.spot_path),
      claim_url: claimUrl(r.spot_name || r.name, r.town || venue?.town)
    });
  }
  return out;
}

export async function onRequestOptions() {
  return options();
}

/**
 * GET /api/admin/reports?days=30
 * GET /api/admin/reports?days=30&spot=The%20Little%20Fleet
 * GET /api/admin/reports?days=30&town=Traverse%20City
 * Authorization: Bearer <ADMIN_PASSWORD>
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: "DB binding missing" }, 500);

  const auth = requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const days = clampDays(url.searchParams.get("days"));
  const spot = (url.searchParams.get("spot") || "").trim();
  const town = (url.searchParams.get("town") || "").trim();
  const region = (url.searchParams.get("region") || "").trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 25) || 25, 1), 100);

  try {
    const spotsRes = await env.DB.prepare(
      `SELECT spot_name, town, COUNT(*) AS events
       FROM events
       WHERE spot_name IS NOT NULL AND spot_name != ''
         AND created_at >= datetime('now', ?)
       GROUP BY spot_name, town
       ORDER BY events DESC
       LIMIT 300`
    )
      .bind(`-${days} days`)
      .all();

    const topRes = await env.DB.prepare(
      `SELECT spot_name, town,
              SUM(CASE WHEN event_name = 'cta_call' THEN 1 ELSE 0 END) AS cta_call,
              SUM(CASE WHEN event_name = 'cta_map' THEN 1 ELSE 0 END) AS cta_map,
              SUM(CASE WHEN event_name = 'cta_directions' THEN 1 ELSE 0 END) AS cta_directions,
              SUM(CASE WHEN event_name = 'cta_details' THEN 1 ELSE 0 END) AS cta_details,
              SUM(CASE WHEN event_name = 'cta_website' THEN 1 ELSE 0 END) AS cta_website,
              SUM(CASE WHEN event_name = 'cta_claim' THEN 1 ELSE 0 END) AS cta_claim,
              SUM(CASE WHEN event_name = 'spot_view' THEN 1 ELSE 0 END) AS spot_view,
              SUM(CASE WHEN event_name IN ('cta_call','cta_map','cta_directions','cta_details','cta_website','cta_claim') THEN 1 ELSE 0 END) AS total_cta,
              COUNT(*) AS total_events
       FROM events
       WHERE spot_name IS NOT NULL AND spot_name != ''
         AND created_at >= datetime('now', ?)
         ${town ? "AND town = ?" : ""}
       GROUP BY spot_name, town
       ORDER BY total_cta DESC, spot_view DESC, total_events DESC
       LIMIT ?`
    );

    const top = town
      ? await topRes.bind(`-${days} days`, town, limit).all()
      : await topRes.bind(`-${days} days`, limit).all();

    const topSpots = await enrichRows(env, top.results || []);

    let spotReport = null;
    if (spot) {
      const byEvent = await env.DB.prepare(
        `SELECT event_name, COUNT(*) AS count
         FROM events
         WHERE created_at >= datetime('now', ?)
           AND spot_name = ?
           ${town ? "AND town = ?" : ""}
         GROUP BY event_name
         ORDER BY count DESC`
      );

      const eventRows = town
        ? await byEvent.bind(`-${days} days`, spot, town).all()
        : await byEvent.bind(`-${days} days`, spot).all();

      const counts = emptyCounts();
      (eventRows.results || []).forEach((row) => accumulate(counts, row.event_name, row.count));

      const recent = await env.DB.prepare(
        `SELECT id, created_at, event_name, source, page_type, path, country, city
         FROM events
         WHERE spot_name = ?
           ${town ? "AND town = ?" : ""}
         ORDER BY id DESC
         LIMIT 30`
      );

      const recentRows = town
        ? await recent.bind(spot, town).all()
        : await recent.bind(spot).all();

      const matched = (spotsRes.results || []).find(
        (s) => s.spot_name === spot && (!town || s.town === town)
      );
      const reportTown = town || matched?.town || null;
      const venue = await lookupVenue(env, spot, reportTown);

      spotReport = {
        spot_name: spot,
        town: reportTown || venue?.town || null,
        days,
        counts,
        by_event: eventRows.results || [],
        recent: recentRows.results || [],
        venue: venue
          ? {
              id: venue.id,
              phone: venue.phone,
              website: venue.website,
              featured: Number(venue.featured) || 0,
              region: venue.region,
              spot_path: venue.spot_path,
              source: venue.source
            }
          : null,
        listing_url: spotUrl(spot, reportTown || venue?.town, venue?.spot_path),
        claim_url: claimUrl(spot, reportTown || venue?.town),
        summary_text: buildSummary({
          spot,
          town: reportTown || venue?.town,
          days,
          counts,
          venue
        }),
        pitch_text: buildPitch({
          spot,
          town: reportTown || venue?.town,
          days,
          counts,
          venue
        })
      };
    }

    // Cold outreach: published, not featured, has phone, priority markets
    const regionFilter = region && PRIORITY_REGIONS.includes(region) ? region : null;
    const coldSql = `
      SELECT id, name, town, region, phone, website, featured, spot_path, source, category
      FROM venues
      WHERE status = 'published'
        AND featured = 0
        AND phone IS NOT NULL AND phone != ''
        AND region IN (${PRIORITY_REGIONS.map(() => "?").join(",")})
        ${regionFilter ? "AND region = ?" : ""}
      ORDER BY
        CASE source WHEN 'curated' THEN 0 WHEN 'yelp' THEN 1 ELSE 2 END,
        CASE WHEN website IS NOT NULL AND website != '' THEN 0 ELSE 1 END,
        name
      LIMIT ?
    `;
    const coldBinds = regionFilter
      ? [...PRIORITY_REGIONS, regionFilter, limit]
      : [...PRIORITY_REGIONS, Math.min(limit * 2, 80)];
    const coldRes = await env.DB.prepare(coldSql).bind(...coldBinds).all();
    const outreachTargets = (coldRes.results || []).map((v) => ({
      venue_id: v.id,
      spot_name: v.name,
      town: v.town,
      region: v.region,
      phone: v.phone,
      website: v.website,
      featured: 0,
      source: v.source,
      category: v.category,
      spot_path: v.spot_path,
      listing_url: spotUrl(v.name, v.town, v.spot_path),
      claim_url: claimUrl(v.name, v.town),
      pitch_text: buildPitch({
        spot: v.name,
        town: v.town,
        days,
        counts: emptyCounts(),
        venue: v
      })
    }));

    const siteTotals = await env.DB.prepare(
      `SELECT event_name, COUNT(*) AS count
       FROM events
       WHERE created_at >= datetime('now', ?)
       GROUP BY event_name
       ORDER BY count DESC`
    )
      .bind(`-${days} days`)
      .all();

    return json({
      ok: true,
      days,
      town: town || null,
      region: regionFilter,
      cta_events: CTA_EVENTS,
      spots: spotsRes.results || [],
      top_spots: topSpots,
      outreach_targets: outreachTargets,
      site_totals: siteTotals.results || [],
      spot_report: spotReport
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
