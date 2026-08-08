import { verifyReportToken } from "./lib/stripe.js";

/**
 * GET /owner-report?v={venueId}&t={token}
 * Shareable 30-day CTA report for claimed/featured venues (signed link).
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return htmlPage("Database unavailable", 500);

  const url = new URL(request.url);
  const venueId = Number(url.searchParams.get("v") || "");
  const token = (url.searchParams.get("t") || "").trim();

  if (!Number.isFinite(venueId) || venueId <= 0 || !token) {
    return htmlPage("Invalid report link.", 400);
  }
  const ok = await verifyReportToken(env, venueId, token);
  if (!ok) return htmlPage("This report link is invalid or expired.", 403);

  const venue = await env.DB.prepare(
    `SELECT id, name, town, region_name, featured, claimed, phone, website, spot_path,
            stripe_customer_id
     FROM venues WHERE id = ?`
  )
    .bind(venueId)
    .first();
  if (!venue) return htmlPage("Venue not found.", 404);

  const days = 30;
  const rows = await env.DB.prepare(
    `SELECT event_name, COUNT(*) AS count
     FROM events
     WHERE created_at >= datetime('now', ?)
       AND spot_name = ?
       AND (town = ? OR town IS NULL OR town = '')
     GROUP BY event_name`
  )
    .bind(`-${days} days`, venue.name, venue.town)
    .all();

  const counts = {
    spot_view: 0,
    cta_call: 0,
    cta_map: 0,
    cta_directions: 0,
    cta_details: 0,
    cta_website: 0,
    cta_claim: 0
  };
  (rows.results || []).forEach((r) => {
    if (Object.prototype.hasOwnProperty.call(counts, r.event_name)) {
      counts[r.event_name] = Number(r.count) || 0;
    }
  });
  const totalCta =
    counts.cta_call +
    counts.cta_map +
    counts.cta_directions +
    counts.cta_details +
    counts.cta_website +
    counts.cta_claim;

  const listingPath = venue.spot_path
    ? `/spots/${String(venue.spot_path).split("/").pop().replace(/\.html$/, "")}`
    : "/";

  const metrics = [
    ["Spot views", counts.spot_view],
    ["Calls", counts.cta_call],
    ["Map taps", counts.cta_map],
    ["Directions", counts.cta_directions],
    ["Details", counts.cta_details],
    ["Website", counts.cta_website],
    ["All CTAs", totalCta]
  ]
    .map(
      ([label, n]) =>
        `<div class="metric"><div class="n">${n}</div><div class="l">${escapeHtml(label)}</div></div>`
    )
    .join("");

  const badges = [
    venue.claimed ? `<span class="badge ok">Verified</span>` : "",
    venue.featured ? `<span class="badge hot">Featured</span>` : ""
  ].join("");

  const body = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(venue.name)} — Owner report | Michigan Happy Hour</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700;9..144,800&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--ink:#14202c;--muted:#5f7385;--line:#d5e0e8;--coral:#E8614D;--blue:#2D6A8F}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'IBM Plex Sans',sans-serif;background:#eef2f5;color:var(--ink);padding:24px 16px 64px}
.wrap{max-width:720px;margin:0 auto}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px;box-shadow:0 8px 28px rgba(20,32,44,.06)}
h1{font-family:Fraunces,Georgia,serif;font-size:clamp(26px,4vw,34px);margin:8px 0 6px}
.meta{color:var(--muted);font-size:14px;line-height:1.5}
.badge{display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:700;margin-right:6px}
.badge.ok{background:#ECFDF5;color:#059669}
.badge.hot{background:#FFF0ED;color:var(--coral)}
.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin:18px 0}
.metric{background:#f4f7f9;border:1px solid var(--line);border-radius:12px;padding:12px}
.metric .n{font-family:Fraunces,Georgia,serif;font-size:28px;font-weight:800}
.metric .l{font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-top:2px}
a.btn{display:inline-flex;padding:12px 16px;border-radius:10px;background:linear-gradient(135deg,var(--blue),var(--coral));color:#fff;font-weight:700;text-decoration:none;margin-top:8px;margin-right:8px}
a.btn.ghost{background:#fff;color:var(--ink);border:1px solid var(--line)}
.actions{margin-top:8px;display:flex;flex-wrap:wrap;gap:8px}
.foot{margin-top:18px;font-size:13px;color:var(--muted);line-height:1.6}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="meta">Michigan Happy Hour · last ${days} days</div>
    <h1>${escapeHtml(venue.name)}</h1>
    <div class="meta">${escapeHtml(venue.town)}${venue.region_name ? " · " + escapeHtml(venue.region_name) : ""}</div>
    <div style="margin-top:10px">${badges}</div>
    <div class="metrics">${metrics}</div>
    <p class="meta">These are taps from people already searching Michigan happy hours — call, map, directions, and listing views on michiganhappyhour.com.</p>
    <div class="actions">
      <a class="btn" href="${escapeAttr(listingPath)}">View public listing</a>
      ${
        venue.stripe_customer_id
          ? `<a class="btn ghost" href="/manage-billing?v=${venueId}&amp;t=${encodeURIComponent(token)}">Manage billing</a>`
          : ""
      }
    </div>
    <div class="foot">${
      venue.featured
        ? "Featured is active. Use Manage billing to update your card or cancel."
        : `Want priority placement? Featured is $79/mo.<br><a href="/for-business/?interest=featured&amp;name=${encodeURIComponent(venue.name)}&amp;town=${encodeURIComponent(venue.town)}#claim">Claim or feature this spot</a>`
    }</div>
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

function htmlPage(message, status) {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Owner report</title></head><body style="font-family:system-ui;padding:40px;color:#14202c"><p>${escapeHtml(message)}</p><p><a href="/">Michigan Happy Hour</a></p></body></html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" }
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
