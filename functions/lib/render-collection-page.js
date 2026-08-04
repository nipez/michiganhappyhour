import { parseJsonArray } from "../api/_venues.js";
import { canonicalSpotPath } from "./render-spot-page.js";

export const COLLECTION_META = {
  "best-breweries": {
    name: "Best Brewery Happy Hours",
    emoji: "🍺",
    blurb:
      "Michigan brewery and taproom happy hours — pints, flights, and pub bites from Beer City to the UP.",
    title: "Best Brewery Happy Hours in Michigan (2026)",
    description:
      "Browse brewery and taproom happy hours across Michigan — Founders, Bell's, Short's, and local craft spots with hours, deals, and maps."
  },
  "best-patios": {
    name: "Best Patios & Rooftops",
    emoji: "☀️",
    blurb:
      "Michigan's best outdoor happy hours — rooftop bars, waterfront decks, beer gardens, and vineyard patios.",
    title: "Best Patios & Rooftops for Happy Hour in Michigan",
    description:
      "Michigan's best outdoor happy hours — rooftop bars, waterfront decks, beachfront BBQ, beer gardens, and vineyard patios across the state."
  },
  "best-late-night": {
    name: "Best Late-Night Happy Hours",
    emoji: "🌙",
    blurb:
      "Happy hours that run late — after-dinner deals, nightcap specials, and spots still pouring after dark.",
    title: "Best Late-Night Happy Hours in Michigan",
    description:
      "Find late-night happy hours in Michigan — after-dinner drink specials, nightcap deals, and bars still pouring past prime time."
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

function hoursLabel(row) {
  if (row.hh_start && row.hh_end) return `${row.hh_start}&ndash;${row.hh_end}`;
  return "Hours TBD";
}

function dealLine(row) {
  const deals = parseJsonArray(row.deals)
    .map((d) => String(d || "").trim())
    .filter((d) => d && !/ask about today|not verified|call for current/i.test(d));
  if (!deals.length) return "Ask about today's specials";
  return deals.slice(0, 3).join(" · ");
}

export function matchesCollection(row, collectionId) {
  const cat = String(row.category || "").toLowerCase();
  const cols = parseJsonArray(row.collections).map((c) => String(c).toLowerCase());
  if (collectionId === "best-breweries") {
    return cat.includes("brew") || cat === "taproom";
  }
  if (collectionId === "best-patios") return cols.includes("patio");
  if (collectionId === "best-late-night") return cols.includes("late");
  return false;
}

export function normalizeCollectionSlug(raw) {
  let s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  s = s.split("/").filter(Boolean).pop() || s;
  if (s.endsWith(".html")) s = s.slice(0, -5);
  return s;
}

export function renderCollectionPage(collectionId, venues) {
  const meta = COLLECTION_META[collectionId];
  if (!meta) return null;

  const count = venues.length;
  const canonical = `https://michiganhappyhour.com/collections/${collectionId}`;
  const title = `${meta.title} | Michigan Happy Hour`;
  const desc = `${meta.description} ${count} spots mapped.`.slice(0, 160);

  const byRegion = new Map();
  for (const v of venues) {
    const key = v.region_name || v.town || "Michigan";
    if (!byRegion.has(key)) byRegion.set(key, []);
    byRegion.get(key).push(v);
  }

  const sections = [...byRegion.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([regionName, list]) => {
      const cards = list
        .map((v) => {
          const href = canonicalSpotPath(v);
          const vibe = (v.vibe || "").trim();
          const vibeOk =
            vibe && !/midweek pour|openstreetmap|not verified|auto-discovered/i.test(vibe);
          return (
            `<div class="cd" style="margin-bottom:16px">` +
            `<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px">` +
            `<div><a href="${escapeAttr(href)}" style="font-size:20px;font-weight:700;color:#1B2838;text-decoration:none">${escapeHtml(v.name)}</a>` +
            `<div style="font-size:15px;color:#6B8A9E">${escapeHtml(v.town || "")}${v.address ? " &middot; " + escapeHtml(v.address) : ""}</div></div>` +
            `<span class="bg" style="background:#EFF6FF;color:#2D6A8F">${escapeHtml(v.category || "Spot")}</span></div>` +
            `<div style="font-size:15px;color:#E8614D;font-weight:700;margin-bottom:6px">${hoursLabel(v)}</div>` +
            (vibeOk
              ? `<p style="font-size:16px;color:#4A6274;font-style:italic;margin:4px 0 8px">&ldquo;${escapeHtml(vibe)}&rdquo;</p>`
              : "") +
            `<div style="font-size:15px;color:#2D6A8F;font-weight:600">${escapeHtml(dealLine(v))}</div>` +
            `<div style="margin-top:10px;display:flex;gap:8px">` +
            `<a href="${escapeAttr(href)}" class="bt bp" style="font-size:14px;padding:8px 14px">View Details</a>` +
            `</div></div>`
          );
        })
        .join("\n");
      return `<h2 style="font-size:24px;font-weight:700;color:#1B2838;margin:28px 0 14px">${escapeHtml(regionName)}</h2>\n${cards}`;
    })
    .join("\n");

  const other = Object.keys(COLLECTION_META)
    .filter((id) => id !== collectionId)
    .map(
      (id) =>
        `<a href="/collections/${id}" style="padding:10px 18px;border-radius:24px;border:1.5px solid #D8E2EA;background:#fff;color:#4A6274;font-size:15px;font-weight:500;text-decoration:none;display:inline-block">${COLLECTION_META[id].emoji} ${escapeHtml(COLLECTION_META[id].name)}</a>`
    )
    .join("\n");

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: meta.name,
    numberOfItems: count,
    itemListElement: venues.slice(0, 80).map((v, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: v.name,
      url: `https://michiganhappyhour.com${canonicalSpotPath(v)}`
    }))
  };

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
<meta property="og:title" content="${escapeAttr(meta.title)}">
<meta property="og:description" content="${escapeAttr(desc)}">
<meta property="og:type" content="website">
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
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',-apple-system,sans-serif;background:#F5F7FA;color:#1B2838;-webkit-font-smoothing:antialiased}
.sf{font-family:'Playfair Display',Georgia,serif}
a{color:#2D6A8F;text-decoration:none}a:hover{color:#E8614D}
.w{max-width:800px;margin:0 auto;padding:0 20px}
.bc{padding:16px 0;font-size:15px;color:#8AA3B5}.bc a{color:#6B8A9E}
.hb{background:linear-gradient(135deg,#1B2838,#2D4A5E);padding:20px 0}
.hb .w{display:flex;align-items:center;justify-content:space-between}
.hb a{color:#E8614D;font-weight:700;font-size:18px}.hb .sn{color:#fff;font-size:20px;font-weight:700}
.cd{background:#fff;border-radius:16px;border:1.5px solid #D8E2EA;padding:28px;margin-bottom:20px;box-shadow:0 2px 12px rgba(45,106,143,0.06)}
.bg{display:inline-block;padding:5px 14px;border-radius:20px;font-size:15px;font-weight:600}
.bt{display:inline-flex;align-items:center;gap:6px;padding:14px 24px;border-radius:12px;font-weight:700;font-size:16px;text-decoration:none}
.bp{background:linear-gradient(135deg,#2D6A8F,#E8614D);color:#fff}
.bo{background:#F5F7FA;border:2px solid #D8E2EA;color:#4A6274}
.ft{border-top:2px solid #D8E2EA;padding:32px 0;text-align:center;margin-top:40px;color:#8AA3B5;font-size:15px;line-height:2}
@media(max-width:600px){.w{padding:0 16px}.cd{padding:20px 18px}}
</style>
</head>
<body>
<div class="hb"><div class="w"><a href="/" class="sn">Michigan Happy Hour</a><a href="/">&larr; All Spots</a></div></div>
<div class="w">
<div class="bc"><a href="/">Home</a> &rarr; Collections &rarr; ${escapeHtml(meta.name)}</div>
<div style="text-align:center;margin:32px 0 24px">
<div style="font-size:48px;margin-bottom:8px">${meta.emoji}</div>
<h1 class="sf" style="font-size:clamp(28px,5vw,38px);font-weight:800;margin-bottom:8px">${escapeHtml(meta.name)}</h1>
<p style="font-size:18px;color:#6B8A9E;max-width:600px;margin:0 auto">${escapeHtml(meta.blurb)}</p>
<div style="margin-top:12px;font-size:16px;color:#2D6A8F;font-weight:700">${count} spot${count === 1 ? "" : "s"} across Michigan</div>
</div>
${sections || `<p style="color:#6B8A9E;text-align:center">No spots in this collection yet.</p>`}
<h2 class="sf" style="font-size:22px;margin:32px 0 16px">More Collections</h2>
<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:32px">${other}</div>
<div style="text-align:center;margin:32px 0"><a href="/" class="bt bp" style="font-size:18px;padding:16px 32px">&larr; Browse All Happy Hours</a></div>
<footer class="ft"><div class="sf" style="font-size:18px;font-weight:700;color:#2D6A8F;margin-bottom:6px">Michigan Happy Hour Guide</div>Built by <a href="https://solutionstud.io/">Solution Studio</a><br>Visit our sister site, <a href="https://traversecitywinetour.com">Traverse City Wine Tour</a><br>Listings are community-sourced &middot; Hours and deals may change &mdash; <a href="/submit/" style="color:#E8614D">suggest an update</a><br><span style="color:#A8BFCC">&copy; ${new Date().getFullYear()} MichiganHappyHour.com</span></footer>
</div>
<script src="/js/cta-track.js" defer></script>
</body>
</html>`;
}
