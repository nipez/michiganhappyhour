/**
 * Claim-outreach helpers: unguessable per-venue tokens + personalized copy.
 * Does not send email — admin copies mailto / SMS text only.
 */

import { isLowVenueTraffic, LOW_TRAFFIC_VIEWS } from "./venue-traffic.js";

const TOKEN_BYTES = 24;

export function randomOutreachToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function claimTrafficPath(token) {
  return `/claim-traffic?t=${encodeURIComponent(token)}`;
}

export function claimTrafficUrl(origin, token) {
  const base = String(origin || "https://michiganhappyhour.com").replace(/\/$/, "");
  return `${base}${claimTrafficPath(token)}`;
}

export function claimFormUrl(venue) {
  const params = new URLSearchParams({
    name: venue?.name || "",
    town: venue?.town || "",
    interest: venue?.featured ? "claim" : "featured"
  });
  if (venue?.phone) params.set("phone", venue.phone);
  if (venue?.website) params.set("website", venue.website);
  return `https://michiganhappyhour.com/for-business/?${params.toString()}#claim`;
}

function fmtNum(n) {
  return String(Number(n) || 0);
}

function proofLine(venueRow, monthLabel) {
  const m = venueRow.metrics || {};
  const presentation = venueRow.presentation;
  const views = Number(m.views) || 0;
  const calls = Number(m.calls) || 0;
  const directions = Number(m.directions) || 0;
  const map = Number(m.map_clicks) || 0;
  const web = Number(m.website_clicks) || 0;
  const period = monthLabel || "last month";

  if (presentation?.mode === "venue" || !isLowVenueTraffic(m)) {
    const bits = [];
    if (views) bits.push(`${fmtNum(views)} listing view${views === 1 ? "" : "s"}`);
    if (calls) bits.push(`${fmtNum(calls)} call tap${calls === 1 ? "" : "s"}`);
    if (directions)
      bits.push(`${fmtNum(directions)} directions tap${directions === 1 ? "" : "s"}`);
    if (map) bits.push(`${fmtNum(map)} map tap${map === 1 ? "" : "s"}`);
    if (web) bits.push(`${fmtNum(web)} website click${web === 1 ? "" : "s"}`);
    if (bits.length) {
      return `In ${period}, your Michigan Happy Hour listing got ${bits.slice(0, 3).join(", ")} from people already searching happy hours.`;
    }
  }

  if (presentation?.mode === "town" || presentation?.mode === "region") {
    return presentation.sub;
  }

  return `Your spot is listed on Michigan Happy Hour, where locals and visitors filter happy hours by day, town, and “live now.”`;
}

/**
 * Longer email body personalized with real traffic figures (or town context).
 */
export function buildOutreachEmail({ venue, monthLabel, trafficUrl }) {
  const name = venue.name || "there";
  const town = venue.town ? ` in ${venue.town}` : "";
  const proof = proofLine(venue, monthLabel);
  const claim = claimFormUrl(venue);
  const linkLine = trafficUrl
    ? `Your private traffic page (not public — don’t share widely): ${trafficUrl}`
    : null;

  return [
    `Hi — quick note from Michigan Happy Hour (michiganhappyhour.com).`,
    "",
    `I'm reaching out about ${name}${town}.`,
    proof,
    "",
    linkLine,
    linkLine ? "" : null,
    `Two options:`,
    `1) Claim the listing (free) — keep hours/deals accurate and see your own monthly stats`,
    `2) Featured placement — $79/mo for priority in your region, homepage/map callouts, and everything in Claimed`,
    "",
    `Request here (about a minute): ${claim}`,
    "",
    `Happy to answer questions.`,
    `— Nick, Michigan Happy Hour`
  ]
    .filter((line) => line != null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Short text / DM version.
 */
export function buildOutreachSms({ venue, monthLabel, trafficUrl }) {
  const m = venue.metrics || {};
  const views = Number(m.views) || 0;
  const name = venue.name || "your spot";
  const town = venue.town || "";
  const claim = claimFormUrl(venue);

  let hook;
  if (!isLowVenueTraffic(m) && views > 0) {
    hook = `${name}${town ? ` (${town})` : ""} got ${views} listing views on Michigan Happy Hour in ${monthLabel || "the last month"}.`;
  } else if (venue.presentation?.mode === "town" || venue.presentation?.mode === "region") {
    hook = venue.presentation.headline;
  } else {
    hook = `${name} is listed on Michigan Happy Hour.`;
  }

  const link = trafficUrl ? ` Private stats: ${trafficUrl}` : "";
  return `${hook} Claim free or go Featured ($79/mo).${link} ${claim} — Nick, MHH`.trim();
}

export function mailtoHref({ email, subject, body }) {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const q = params.toString();
  const to = email ? encodeURIComponent(email) : "";
  return `mailto:${to}${q ? `?${q}` : ""}`;
}

export function outreachSubject(venue) {
  const name = venue.name || "your listing";
  return `Traffic for ${name} on Michigan Happy Hour`;
}

/** Ensure venue has a token; returns { token, created }. */
export async function ensureOutreachToken(env, venueId, { rotate = false } = {}) {
  const id = Number(venueId);
  if (!Number.isFinite(id) || id <= 0) throw new Error("Invalid venue id");

  if (!rotate) {
    const existing = await env.DB.prepare(
      `SELECT outreach_token FROM venues WHERE id = ?`
    )
      .bind(id)
      .first();
    if (existing?.outreach_token) {
      return { token: existing.outreach_token, created: false };
    }
  }

  // Retry on rare unique collisions
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = randomOutreachToken();
    try {
      const res = await env.DB.prepare(
        `UPDATE venues SET outreach_token = ?, updated_at = datetime('now') WHERE id = ?`
      )
        .bind(token, id)
        .run();
      if (res.meta?.changes === 0) throw new Error("Venue not found");
      return { token, created: true };
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (/UNIQUE|unique/i.test(msg) && attempt < 4) continue;
      throw err;
    }
  }
  throw new Error("Could not allocate outreach token");
}

export async function lookupVenueByOutreachToken(env, token) {
  const t = String(token || "").trim();
  if (!t || t.length < 16) return null;
  return env.DB.prepare(
    `SELECT id, name, town, region, region_name, featured, claimed, claimed_at,
            phone, website, spot_path, outreach_token, status
     FROM venues
     WHERE outreach_token = ? AND status = 'published'
     LIMIT 1`
  )
    .bind(t)
    .first();
}

export { isLowVenueTraffic, LOW_TRAFFIC_VIEWS };
