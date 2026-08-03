import { parseJsonArray } from "../api/_venues.js";
import { canonicalSpotPath } from "./render-spot-page.js";

export const REGION_META = {
  "traverse-city": {
    name: "Traverse City",
    emoji: "🏙️",
    blurb:
      "Downtown TC packs brewery pints, pizza slices, wine specials, and craft cocktails into walkable blocks — real hours and deals, mapped.",
    blog: "/blog/traverse-city-happy-hour-guide"
  },
  leelanau: {
    name: "Leelanau Peninsula",
    emoji: "🍇",
    blurb:
      "Wine country happy hours with bay views. Suttons Bay, Leland, and Glen Arbor spots for pints, cider, and tasting-room specials."
  },
  "old-mission": {
    name: "Old Mission Peninsula",
    emoji: "🍷",
    blurb:
      "Vineyard-covered land surrounded by Grand Traverse Bay. Tasting rooms and restaurants for the after-tour circuit with a view."
  },
  "elk-rapids": {
    name: "Elk Rapids & Torch Lake",
    emoji: "🌊",
    blurb:
      "Crystal-clear water and a walkable downtown. Elk Rapids and Torch Lake spots for cocktails, pub fare, and seasonal specials."
  },
  "frankfort-benzie": {
    name: "Frankfort & Benzie County",
    emoji: "⛵",
    blurb:
      "Lake Michigan sunsets, Sleeping Bear nearby, and a tight brewery scene with real happy hour hours."
  },
  "charlevoix-petoskey": {
    name: "Charlevoix & Petoskey",
    emoji: "🪨",
    blurb:
      "Mushroom houses, Hemingway history, and the Gaslight District — plus brewery and bistro happy hours worth planning around."
  },
  "bellaire-mancelona": {
    name: "Bellaire & Antrim County",
    emoji: "🏔️",
    blurb:
      "Home of Short’s Brewing — the craft beer pilgrimage of Northern Michigan — plus nearby bistros with real happy hour windows."
  },
  mackinaw: {
    name: "Mackinaw City & Mackinac Island",
    emoji: "🌉",
    blurb:
      "Where the bridge meets the island. Happy hours with Straits views and walkable downtown energy."
  },
  "grand-rapids": {
    name: "Grand Rapids",
    emoji: "🍺",
    blurb:
      "Beer City USA happy hours deliver serious value — brewery pints, Wealthy Street cocktails, and downtown after-work deals.",
    blog: "/blog/grand-rapids-happy-hour-guide"
  },
  "ann-arbor": {
    name: "Ann Arbor",
    emoji: "🎓",
    blurb:
      "College-town energy meets serious dining. Main Street, Kerrytown, and campus-adjacent spots with real hours and specials.",
    blog: "/blog/ann-arbor-happy-hour-guide"
  },
  detroit: {
    name: "Detroit",
    emoji: "🏭",
    blurb:
      "From Corktown speakeasies to Midtown taprooms and Greektown taverns — real weekday hours and drink specials so you can plan after-work without guessing.",
    blog: "/blog/detroit-happy-hour-guide"
  },
  kalamazoo: {
    name: "Kalamazoo",
    emoji: "🍻",
    blurb:
      "Home of Bell’s and a deep craft scene — brewery pints, downtown cocktails, and food specials with real hours."
  },
  lansing: {
    name: "Lansing & East Lansing",
    emoji: "🏛️",
    blurb:
      "Capitol after-work and campus weeknights covered — real hours and specials across Lansing and East Lansing."
  },
  holland: {
    name: "Holland",
    emoji: "🌷",
    blurb:
      "Downtown Holland happy hours mix brewery classics with lakeshore dining — real hours and drink specials."
  },
  muskegon: {
    name: "Muskegon",
    emoji: "⚓",
    blurb:
      "Port-city happy hours with beach-town energy — craft beer, waterfront decks, and downtown bars."
  },
  marquette: {
    name: "Marquette (UP)",
    emoji: "🏔️",
    blurb:
      "Lake Superior energy — craft beer patios, waterfront pubs, and wine bars with real hours."
  },
  "tri-cities": {
    name: "Saginaw / Bay City / Midland",
    emoji: "🏙️",
    blurb:
      "Happy hour across Michigan’s Tri-Cities: Midland taprooms, Saginaw taverns, and Bay City wine bars with real hours."
  },
  flint: {
    name: "Flint",
    emoji: "🔧",
    blurb:
      "Vehicle City’s after-work scene spans converted firehouse breweries, longtime taverns, and downtown cocktail spots."
  }
};

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

function daysLabel(days) {
  const d = parseJsonArray(days);
  if (!d.length) return "Hours TBD";
  if (d.length === 7) return "Every day";
  return `${d.length} days/week`;
}

function hoursLabel(row) {
  if (row.hh_start && row.hh_end) return `${row.hh_start}&ndash;${row.hh_end}`;
  return "Hours TBD";
}

function dealHook(row) {
  const deals = parseJsonArray(row.deals);
  const first = (deals[0] || "").trim();
  if (!first) return "Call for current specials";
  return first.length > 72 ? first.slice(0, 69).replace(/\s+\S*$/, "") + "…" : first;
}

export function normalizeRegionSlug(raw) {
  let s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  s = s.split("/").filter(Boolean).pop() || s;
  if (s.endsWith(".html")) s = s.slice(0, -5);
  return s;
}

export function renderRegionPage(regionId, venues, allRegionCounts = {}) {
  const meta = REGION_META[regionId];
  if (!meta) return null;

  const count = venues.length;
  const name = meta.name;
  const title = `${name} Happy Hour Guide (${new Date().getFullYear()}) | ${count}+ Spots`;
  const desc = `${name} happy hours with real hours and specials — ${count} spots mapped across the area. Filter, map, and plan after-work without guessing. Updated weekly.`.slice(
    0,
    160
  );
  const canonical = `https://michiganhappyhour.com/regions/${regionId}`;
  const interactive = `/?region=${encodeURIComponent(regionId)}#listings-top`;

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${name} Happy Hour Guide`,
    numberOfItems: count,
    itemListElement: venues.slice(0, 100).map((v, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: v.name,
      url: `https://michiganhappyhour.com${canonicalSpotPath(v)}`
    }))
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://michiganhappyhour.com/" },
      { "@type": "ListItem", position: 2, name: `${name} Happy Hour`, item: canonical }
    ]
  };

  const cards = venues
    .map((v) => {
      const href = canonicalSpotPath(v);
      const vibe = (v.vibe || "").trim();
      const vibeShort =
        vibe.length > 110 ? vibe.slice(0, 107).replace(/\s+\S*$/, "") + "…" : vibe;
      const cat = v.category || "Spot";
      return (
        `<a href="${escapeAttr(href)}" class="nc">` +
        `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">` +
        `<div style="font-weight:700;font-size:18px;color:#1B2838">${escapeHtml(v.name)}</div>` +
        `<div style="font-weight:700;font-size:15px;color:#E8614D;white-space:nowrap">${hoursLabel(v)}</div>` +
        `</div>` +
        `<div style="font-size:15px;color:#6B8A9E;margin-bottom:4px">${escapeHtml(v.town || "")}` +
        `${v.address ? " &middot; " + escapeHtml(v.address) : ""}` +
        ` &middot; <span class="bg" style="font-size:13px;padding:3px 10px;background:#EFF6FF;color:#2D6A8F">${escapeHtml(cat)}</span>` +
        ` &middot; ${escapeHtml(daysLabel(v.hh_days))}</div>` +
        (vibeShort
          ? `<div style="font-size:15px;color:#4A6274;font-style:italic">&ldquo;${escapeHtml(vibeShort)}&rdquo;</div>`
          : "") +
        `<div style="font-size:14px;color:#E8614D;font-weight:600;margin-top:6px">&rarr; ${escapeHtml(dealHook(v))}</div>` +
        `</a>`
      );
    })
    .join("\n");

  const otherRegions = Object.keys(REGION_META)
    .filter((id) => id !== regionId)
    .map((id) => {
      const m = REGION_META[id];
      const n = allRegionCounts[id] || 0;
      return `<a href="/regions/${id}" style="padding:10px 18px;border-radius:24px;border:1.5px solid #D8E2EA;background:#fff;color:#4A6274;font-size:15px;font-weight:500;text-decoration:none;display:inline-block">${m.emoji} ${escapeHtml(m.name)}${n ? ` (${n})` : ""}</a>`;
    })
    .join("\n");

  const blogBlock = meta.blog
    ? `<div style="margin:28px 0 8px;padding:16px 18px;background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:12px;font-size:16px;line-height:1.5">
<strong>City guide:</strong> <a href="${escapeAttr(meta.blog)}" style="color:#E8614D;font-weight:700">Read the ${escapeHtml(name)} happy hour guide</a> for itineraries, neighborhoods, and standout deals.
</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-4NCRX2Y71B"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-4NCRX2Y71B');
</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeAttr(desc)}">
<meta property="og:title" content="${escapeAttr(`${name} Happy Hour Guide | Best Deals & Hours`)}">
<meta property="og:type" content="website">
<meta property="og:description" content="${escapeAttr(desc)}">
<meta property="og:url" content="${escapeAttr(canonical)}">
<meta property="og:image" content="https://michiganhappyhour.com/img/hero.jpg">
<meta property="og:site_name" content="Michigan Happy Hour Guide">
<link rel="canonical" href="${escapeAttr(canonical)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeAttr(title)}">
<meta name="twitter:description" content="${escapeAttr(desc)}">
<meta name="twitter:image" content="https://michiganhappyhour.com/img/hero.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(itemList)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',-apple-system,sans-serif;background:#F5F7FA;color:#1B2838;-webkit-font-smoothing:antialiased}
.sf{font-family:'Playfair Display',Georgia,serif}
a{color:#2D6A8F;text-decoration:none}a:hover{color:#E8614D}
.w{max-width:960px;margin:0 auto;padding:0 20px}
.bc{padding:16px 0;font-size:15px;color:#8AA3B5}.bc a{color:#6B8A9E}
.hb{background:linear-gradient(135deg,#1B2838,#2D4A5E);padding:20px 0}
.hb .w{display:flex;align-items:center;justify-content:space-between}
.hb a{color:#E8614D;font-weight:700;font-size:18px}
.hb .sn{color:#fff;font-size:20px;font-weight:700}
.bg{display:inline-block;padding:5px 14px;border-radius:20px;font-size:15px;font-weight:600}
.bt{display:inline-flex;align-items:center;gap:6px;padding:14px 24px;border-radius:12px;font-weight:700;font-size:16px;text-decoration:none}
.bp{background:linear-gradient(135deg,#2D6A8F,#E8614D);color:#fff}
.bo{background:#F5F7FA;border:2px solid #D8E2EA;color:#4A6274}
.nc{display:block;background:#fff;border-radius:12px;border:1.5px solid #D8E2EA;padding:16px 18px;transition:all 0.2s;text-decoration:none;color:inherit}
.nc:hover{border-color:#E8614D;box-shadow:0 4px 16px rgba(232,97,77,0.1)}
.ft{border-top:2px solid #D8E2EA;padding:32px 0;text-align:center;margin-top:40px;color:#8AA3B5;font-size:15px;line-height:2}
.cta-row{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 8px}
@media(max-width:600px){.w{padding:0 16px}}
</style>
</head>
<body>
<div class="hb"><div class="w"><a href="/" class="sn">Michigan Happy Hour</a><a href="${escapeAttr(interactive)}">Open filter &amp; map</a></div></div>
<div class="w">
<div class="bc"><a href="/">Home</a> &rarr; ${escapeHtml(name)}</div>
<div style="margin-bottom:28px">
<div style="font-size:40px;margin-bottom:8px">${meta.emoji}</div>
<h1 class="sf" style="font-size:clamp(28px,5vw,40px);font-weight:800;margin-bottom:10px">${escapeHtml(name)} Happy Hour Guide</h1>
<p style="font-size:18px;color:#4A6274;line-height:1.6;max-width:640px">${escapeHtml(meta.blurb)}</p>
<div style="margin-top:12px;font-size:16px;color:#2D6A8F;font-weight:700">${count} happy hour spot${count === 1 ? "" : "s"}</div>
<div class="cta-row">
<a class="bt bp" href="${escapeAttr(interactive)}">Filter &amp; map ${escapeHtml(name)}</a>
<a class="bt bo" href="/?region=${encodeURIComponent(regionId)}" onclick="try{localStorage.setItem('hh-region','${escapeAttr(regionId)}')}catch(e){}">Set as my default region</a>
</div>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,380px),1fr));gap:12px;margin-bottom:32px">
${cards || `<p style="color:#6B8A9E">No published spots in this region yet.</p>`}
</div>
${blogBlock}
<h2 class="sf" style="font-size:22px;margin:32px 0 16px">Explore Other Regions</h2>
<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:32px">${otherRegions}</div>
<div style="text-align:center;margin:32px 0"><a href="/" class="bt bp" style="font-size:18px;padding:16px 32px">&larr; Browse All Happy Hours</a></div>
<footer class="ft"><div class="sf" style="font-size:18px;font-weight:700;color:#2D6A8F;margin-bottom:6px">Michigan Happy Hour Guide</div>Built by <a href="https://solutionstud.io/">Solution Studio</a><br>Visit our sister site, <a href="https://traversecitywinetour.com">Traverse City Wine Tour</a><br>Listings are community-sourced &middot; Hours and deals may change &mdash; <a href="/submit/" style="color:#E8614D">suggest an update</a><br><span style="color:#A8BFCC">&copy; ${new Date().getFullYear()} MichiganHappyHour.com</span></footer>
</div>
<script src="/js/cta-track.js" defer></script>
</body>
</html>`;
}
