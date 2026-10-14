/**
 * Crawlable index / hub pages for /spots, /towns, /regions, /collections.
 * Replaces the previous soft 302 → / which wasted crawl budget.
 */

import { REGION_META } from "./render-region-page.js";
import { COLLECTION_META } from "./render-collection-page.js";
import { canonicalTownPath } from "./towns.js";

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

function pageShell({ title, description, canonicalPath, h1, lead, bodyHtml }) {
  const canonical = `https://michiganhappyhour.com${canonicalPath}`;
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeAttr(description)}">
<link rel="canonical" href="${escapeAttr(canonical)}">
<meta property="og:title" content="${escapeAttr(title)}">
<meta property="og:description" content="${escapeAttr(description)}">
<meta property="og:url" content="${escapeAttr(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Michigan Happy Hour Guide">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',-apple-system,sans-serif;background:#F5F7FA;color:#1B2838;-webkit-font-smoothing:antialiased}
.sf{font-family:'Playfair Display',Georgia,serif}
a{color:#2D6A8F;text-decoration:none}a:hover{color:#E8614D}
.w{max-width:900px;margin:0 auto;padding:0 20px}
.hb{background:linear-gradient(135deg,#1B2838,#2D4A5E);padding:20px 0}
.hb .w{display:flex;align-items:center;justify-content:space-between}
.hb a{color:#E8614D;font-weight:700;font-size:16px}.hb .sn{color:#fff;font-size:20px;font-weight:700}
.hero{padding:36px 0 12px}
.hero h1{font-family:'Playfair Display',Georgia,serif;font-size:clamp(28px,4vw,40px);margin-bottom:10px}
.hero p{color:#4A6274;font-size:17px;line-height:1.55;max-width:640px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;padding:20px 0 40px}
.card{display:block;background:#fff;border:1.5px solid #D8E2EA;border-radius:14px;padding:16px 18px;transition:border-color .15s,box-shadow .15s;color:inherit}
.card:hover{border-color:#E8614D;box-shadow:0 4px 16px rgba(232,97,77,0.1)}
.card .name{font-weight:700;font-size:17px;margin-bottom:4px}
.card .meta{font-size:14px;color:#8AA3B5}
.links{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0 24px}
.chip{display:inline-block;padding:10px 16px;border-radius:24px;border:1.5px solid #D8E2EA;background:#fff;font-size:15px;font-weight:500;color:#4A6274}
.chip:hover{border-color:#E8614D;color:#E8614D}
.ft{border-top:2px solid #D8E2EA;padding:32px 0;text-align:center;margin-top:24px;color:#8AA3B5;font-size:15px;line-height:2}
</style>
</head>
<body>
<div class="hb"><div class="w"><a href="/" class="sn">Michigan Happy Hour</a><a href="/">&larr; Home</a></div></div>
<div class="w">
  <div class="hero">
    <h1>${escapeHtml(h1)}</h1>
    <p>${escapeHtml(lead)}</p>
  </div>
  ${bodyHtml}
</div>
<footer class="ft"><div class="sf" style="font-size:18px;font-weight:700;color:#2D6A8F;margin-bottom:6px">Michigan Happy Hour Guide</div>
Listings are community-sourced &middot; Hours and deals may change &mdash; <a href="/submit/" style="color:#E8614D">suggest an update</a><br>
<span style="color:#A8BFCC">&copy; ${year} MichiganHappyHour.com</span></footer>
</body>
</html>`;
}

/** /regions — list every region hub. */
export function renderRegionsIndex(counts = {}) {
  const entries = Object.entries(REGION_META)
    .map(([id, meta]) => ({
      id,
      name: meta.name,
      count: counts[id] || 0,
      blurb: meta.blurb || ""
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const total = entries.reduce((n, e) => n + e.count, 0);
  const cards = entries
    .map(
      (e) =>
        `<a class="card" href="/regions/${escapeAttr(e.id)}"><div class="name">${escapeHtml(e.name)}</div><div class="meta">${e.count} spot${e.count === 1 ? "" : "s"}</div></a>`
    )
    .join("");

  return pageShell({
    title: "Michigan Happy Hour Regions | Browse by City & Area",
    description:
      "Browse Michigan happy hours by region — Detroit, Grand Rapids, Traverse City, Ann Arbor, and more with real hours and drink specials.",
    canonicalPath: "/regions",
    h1: "Happy hour by region",
    lead: `${total.toLocaleString()} published spots across ${entries.length} Michigan regions. Pick a hub to see hours, deals, and maps.`,
    bodyHtml: `<div class="grid">${cards}</div>`
  });
}

/** /towns — list qualifying town landing pages. */
export function renderTownsIndex(towns = []) {
  const cards = towns
    .map(
      (t) =>
        `<a class="card" href="${escapeAttr(canonicalTownPath(t.slug))}"><div class="name">${escapeHtml(t.name)}</div><div class="meta">${t.withHours.length} with verified hours${t.region_name ? ` · ${escapeHtml(t.region_name)}` : ""}</div></a>`
    )
    .join("");

  return pageShell({
    title: "Michigan Happy Hour Towns | City Landing Pages",
    description:
      "Browse Michigan happy hour town guides — cities with enough verified hours for a dedicated landing page.",
    canonicalPath: "/towns",
    h1: "Happy hour by town",
    lead: `${towns.length} towns with enough verified happy hour hours for a dedicated page. Looking for something else? Try regions or search.`,
    bodyHtml: `<div class="links"><a class="chip" href="/regions">All regions</a><a class="chip" href="/?q=">Search spots</a><a class="chip" href="/map/">Map</a></div><div class="grid">${cards || "<p>No town pages yet.</p>"}</div>`
  });
}

/** /collections — list curated collections. */
export function renderCollectionsIndex() {
  const cards = Object.entries(COLLECTION_META)
    .map(
      ([id, meta]) =>
        `<a class="card" href="/collections/${escapeAttr(id)}"><div class="name">${escapeHtml(meta.emoji || "")} ${escapeHtml(meta.name)}</div><div class="meta">${escapeHtml(meta.blurb || "")}</div></a>`
    )
    .join("");

  return pageShell({
    title: "Michigan Happy Hour Collections | Curated Lists",
    description:
      "Curated Michigan happy hour collections — best breweries, patios & rooftops, and late-night deals.",
    canonicalPath: "/collections",
    h1: "Curated collections",
    lead: "Hand-picked lists when you know the vibe but not the neighborhood.",
    bodyHtml: `<div class="grid">${cards}</div>`
  });
}

/**
 * /spots — navigational hub (full 1,200+ dump is too heavy; point crawlers at regions/towns).
 */
export function renderSpotsIndex(counts = {}, towns = []) {
  const regions = Object.entries(REGION_META)
    .map(([id, meta]) => ({ id, name: meta.name, count: counts[id] || 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const regionCards = regions
    .slice(0, 24)
    .map(
      (e) =>
        `<a class="card" href="/regions/${escapeAttr(e.id)}"><div class="name">${escapeHtml(e.name)}</div><div class="meta">${e.count} spots</div></a>`
    )
    .join("");

  const townChips = towns
    .slice(0, 18)
    .map(
      (t) =>
        `<a class="chip" href="${escapeAttr(canonicalTownPath(t.slug))}">${escapeHtml(t.name)}</a>`
    )
    .join("");

  const total = regions.reduce((n, e) => n + e.count, 0);

  return pageShell({
    title: "Michigan Happy Hour Spots | Browse 1,200+ Listings",
    description:
      "Find Michigan happy hour spots by region, town, collection, or search — verified hours and drink specials statewide.",
    canonicalPath: "/spots",
    h1: "Browse happy hour spots",
    lead: `${total.toLocaleString()}+ Michigan bars, breweries, and restaurants with real happy hour hours. Start with a region, town, or search.`,
    bodyHtml: `
<div class="links">
  <a class="chip" href="/?q=">Search all spots</a>
  <a class="chip" href="/map/">Interactive map</a>
  <a class="chip" href="/regions">All regions</a>
  <a class="chip" href="/towns">Town guides</a>
  <a class="chip" href="/collections">Collections</a>
</div>
<h2 class="sf" style="font-size:22px;margin:8px 0 4px">Popular regions</h2>
<div class="grid">${regionCards}</div>
<h2 class="sf" style="font-size:22px;margin:8px 0 12px">Towns with guides</h2>
<div class="links">${townChips}</div>`
  });
}
