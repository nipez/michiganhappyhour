/**
 * GET /claim-traffic?t={outreach_token}
 * Private per-venue monthly traffic page for claim outreach.
 * Token is unguessable and stored on venues.outreach_token (admin generate/rotate).
 * No venue id/slug in the URL — no public enumeration.
 */
import {
  getVenueMonthTraffic,
  isLowVenueTraffic
} from "./lib/venue-traffic.js";
import {
  claimFormUrl,
  lookupVenueByOutreachToken
} from "./lib/claim-outreach.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return htmlPage("Database unavailable", 500);

  const url = new URL(request.url);
  const token = (url.searchParams.get("t") || "").trim();
  const monthRaw = (url.searchParams.get("month") || "").trim();

  if (!token) return htmlPage("This link is missing its access token.", 404);

  let venue;
  try {
    venue = await lookupVenueByOutreachToken(env, token);
  } catch (err) {
    return htmlPage("Could not load this page.", 500);
  }
  if (!venue) return htmlPage("This traffic link is invalid or has been rotated.", 404);

  let report;
  try {
    report = await getVenueMonthTraffic(env, venue.id, monthRaw || undefined, {
      skipCache: false,
      ctx: context
    });
  } catch (err) {
    return htmlPage("Could not load traffic for this venue.", 500);
  }

  const row = report.venue;
  if (!row) return htmlPage("Venue not found.", 404);

  const metrics = row.metrics || {};
  const change = row.change || {};
  const presentation = report.presentation || {
    mode: "soft",
    headline: `${venue.name} on Michigan Happy Hour`,
    sub: "Claim your listing to keep hours accurate."
  };
  const claimUrl = claimFormUrl(venue);
  const featuredUrl = claimUrl.replace("interest=claim", "interest=featured");
  const listingPath = row.listing_path || "/";
  const low = isLowVenueTraffic(metrics);

  const metricCards = [
    ["Views", metrics.views, change.views],
    ["Calls", metrics.calls, change.calls],
    ["Directions", metrics.directions, change.directions],
    ["Map taps", metrics.map_clicks, change.map_clicks],
    ["Website", metrics.website_clicks, change.website_clicks]
  ]
    .filter(([_, value]) => {
      // When leading with soft/town context, omit pure-zero cards so 0s aren't the story
      if (presentation.mode === "venue") return true;
      if (presentation.mode === "soft" && low) return false;
      return Number(value) > 0;
    })
    .map(
      ([label, value, delta]) =>
        `<div class="metric"><div class="n">${escapeHtml(value ?? 0)}</div><div class="l">${escapeHtml(label)}</div>${fmtDelta(delta)}</div>`
    )
    .join("");

  const badges = [
    venue.claimed ? `<span class="badge ok">Verified</span>` : `<span class="badge">Unclaimed</span>`,
    venue.featured ? `<span class="badge hot">Featured</span>` : ""
  ].join("");

  const body = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(venue.name)} — Your traffic | Michigan Happy Hour</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700;9..144,800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--ink:#14202c;--muted:#5f7385;--line:#d5e0e8;--coral:#E8614D;--blue:#2D6A8F;--sand:#f3efe6}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'IBM Plex Sans',sans-serif;background:linear-gradient(165deg,#e8eef3 0%,var(--sand) 45%,#eef2f5 100%);color:var(--ink);padding:28px 16px 72px;min-height:100vh;-webkit-font-smoothing:antialiased}
.wrap{max-width:720px;margin:0 auto}
.brand{font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--blue);margin-bottom:14px}
.card{background:rgba(255,255,255,.92);border:1px solid var(--line);border-radius:18px;padding:26px 22px;box-shadow:0 12px 40px rgba(20,32,44,.07)}
h1{font-family:Fraunces,Georgia,serif;font-size:clamp(26px,4.5vw,36px);line-height:1.15;margin:8px 0 8px}
.meta{color:var(--muted);font-size:14px;line-height:1.55}
.badge{display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:700;margin-right:6px;margin-top:10px;background:#eef2f5;color:var(--muted)}
.badge.ok{background:#ECFDF5;color:#059669}
.badge.hot{background:#FFF0ED;color:var(--coral)}
.lead{margin:18px 0 6px;font-size:17px;line-height:1.5;color:#314455}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:18px 0}
.metric{background:#f4f7f9;border:1px solid var(--line);border-radius:12px;padding:12px}
.metric .n{font-family:Fraunces,Georgia,serif;font-size:28px;font-weight:800;line-height:1}
.metric .l{font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-top:4px}
.metric .d{font-size:12px;margin-top:6px;font-weight:600}
.metric .d.up{color:#059669}.metric .d.down{color:var(--coral)}.metric .d.flat{color:var(--muted)}
.cta{margin-top:22px;display:flex;flex-wrap:wrap;gap:10px}
a.btn{display:inline-flex;align-items:center;padding:13px 18px;border-radius:11px;background:linear-gradient(135deg,var(--blue),var(--coral));color:#fff;font-weight:700;text-decoration:none;font-size:15px}
a.btn.ghost{background:#fff;color:var(--ink);border:1.5px solid var(--line)}
.upsell{margin-top:20px;padding:16px;border-radius:12px;background:linear-gradient(135deg,rgba(45,106,143,.08),rgba(232,97,77,.08));border:1px solid var(--line)}
.upsell strong{font-family:Fraunces,Georgia,serif;font-size:18px;display:block;margin-bottom:6px}
.foot{margin-top:20px;font-size:12px;color:var(--muted);line-height:1.6}
</style>
</head>
<body>
<div class="wrap">
  <div class="brand">Michigan Happy Hour</div>
  <div class="card">
    <div class="meta">${escapeHtml(report.month_label || "Last month")} · private link</div>
    <h1>${escapeHtml(presentation.headline)}</h1>
    <div class="meta">${escapeHtml(venue.name)}${venue.town ? " · " + escapeHtml(venue.town) : ""}${venue.region_name ? " · " + escapeHtml(venue.region_name) : ""}</div>
    <div>${badges}</div>
    <p class="lead">${escapeHtml(presentation.sub)}</p>
    ${metricCards ? `<div class="metrics">${metricCards}</div>` : ""}
    ${
      presentation.mode === "venue"
        ? `<p class="meta">Change vs ${escapeHtml(report.prev_month_label || "prior month")} shown under each metric. Numbers come from real taps on michiganhappyhour.com — not estimates.</p>`
        : ""
    }
    <div class="cta">
      <a class="btn" href="${escapeAttr(claimUrl)}">${venue.claimed ? "Update listing / go Featured" : "Claim this listing (free)"}</a>
      <a class="btn ghost" href="${escapeAttr(listingPath)}">View public listing</a>
    </div>
    ${
      venue.featured
        ? ""
        : `<div class="upsell">
      <strong>Featured — $79/mo</strong>
      <p class="meta" style="margin:0">Priority in your region, homepage and map callouts, and monthly traffic stats. Same request form — pick Featured.</p>
      <div class="cta" style="margin-top:12px">
        <a class="btn" href="${escapeAttr(featuredUrl)}">Upgrade to Featured</a>
      </div>
    </div>`
    }
    <div class="foot">This page is private (noindex). If you received this link by mistake, you can ignore it. Questions: use the claim form above.</div>
  </div>
</div>
</body>
</html>`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}

function fmtDelta(n) {
  if (n == null || n === 0) {
    return `<div class="d flat">vs prior: 0</div>`;
  }
  const cls = n > 0 ? "up" : "down";
  const sign = n > 0 ? "+" : "";
  return `<div class="d ${cls}">vs prior: ${sign}${escapeHtml(n)}</div>`;
}

function htmlPage(message, status) {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>Traffic link | Michigan Happy Hour</title></head><body style="font-family:system-ui;padding:40px;color:#14202c;background:#eef2f5"><p>${escapeHtml(message)}</p><p><a href="/">Michigan Happy Hour</a></p></body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow",
        "Cache-Control": "private, no-store"
      }
    }
  );
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
