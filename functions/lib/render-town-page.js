import { parseJsonArray } from "../api/_venues.js";
import { REGION_META } from "./render-region-page.js";
import { canonicalSpotPath } from "./render-spot-page.js";
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

function daysLabel(days) {
  const d = parseJsonArray(days);
  if (!d.length) return "Days vary";
  if (d.length === 7) return "Every day";
  return d.join(", ");
}

function hoursLabel(row) {
  if (row.hh_start && row.hh_end) return `${row.hh_start}&ndash;${row.hh_end}`;
  return "Hours TBD";
}

function dealHook(row) {
  const deals = parseJsonArray(row.deals)
    .map((d) => String(d || "").trim())
    .filter((d) => d && !/ask about today|not verified|call for current/i.test(d));
  const first = deals[0] || "";
  if (!first) return "Call for current specials";
  return first.length > 72 ? first.slice(0, 69).replace(/\s+\S*$/, "") + "…" : first;
}

/**
 * Render a gated town landing page.
 * @param {{ slug: string, name: string, region: string, region_name: string, withHours: object[] }} town
 * @param {object[]} siblingTowns other qualifying towns (for internal links)
 */
export function renderTownPage(town, siblingTowns = []) {
  if (!town?.slug || !town?.name) return null;

  const spots = [...(town.withHours || [])].sort((a, b) => {
    const af = a.featured ? 0 : 1;
    const bf = b.featured ? 0 : 1;
    if (af !== bf) return af - bf;
    return String(a.name || "").localeCompare(String(b.name || ""), undefined, {
      sensitivity: "base"
    });
  });

  const count = spots.length;
  if (!count) return null;

  const name = town.name;
  const year = new Date().getFullYear();
  const regionId = town.region || "";
  const regionMeta = REGION_META[regionId];
  const regionLabel = town.region_name || regionMeta?.name || "Michigan";
  const regionPath = regionId ? `/regions/${regionId}` : "/";

  const title = `Happy Hour in ${name}, Michigan (${year}) | ${count} Spots`.slice(0, 60);
  const desc =
    `Happy hour in ${name}, Michigan — ${count} bars, breweries & restaurants with real hours, drink specials, and maps. Updated ${year}.`.slice(
      0,
      160
    );
  const canonical = `https://michiganhappyhour.com${canonicalTownPath(town.slug)}`;
  const interactive = `/?q=${encodeURIComponent(name)}#listings-top`;

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Happy Hour in ${name}, Michigan`,
    numberOfItems: count,
    itemListElement: spots.slice(0, 100).map((v, i) => ({
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
      ...(regionId
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: regionLabel,
              item: `https://michiganhappyhour.com${regionPath}`
            },
            { "@type": "ListItem", position: 3, name: `${name} Happy Hour`, item: canonical }
          ]
        : [{ "@type": "ListItem", position: 2, name: `${name} Happy Hour`, item: canonical }])
    ]
  };

  const cards = spots
    .map((v) => {
      const href = canonicalSpotPath(v);
      const vibe = (v.vibe || "").trim();
      const vibeOk =
        vibe && !/midweek pour|openstreetmap|not verified|auto-discovered/i.test(vibe);
      const vibeShort =
        vibeOk && vibe.length > 110
          ? vibe.slice(0, 107).replace(/\s+\S*$/, "") + "…"
          : vibeOk
            ? vibe
            : "";
      const cat = v.category || "Spot";
      return (
        `<a href="${escapeAttr(href)}" class="nc">` +
        `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">` +
        `<div style="font-weight:700;font-size:18px;color:#1B2838">${escapeHtml(v.name)}</div>` +
        `<div style="font-weight:700;font-size:15px;color:#E8614D;white-space:nowrap">${hoursLabel(v)}</div>` +
        `</div>` +
        `<div style="font-size:15px;color:#6B8A9E;margin-bottom:4px">` +
        `${v.address ? escapeHtml(v.address) + " &middot; " : ""}` +
        `<span class="bg" style="font-size:13px;padding:3px 10px;background:#EFF6FF;color:#2D6A8F">${escapeHtml(cat)}</span>` +
        ` &middot; ${escapeHtml(daysLabel(v.hh_days))}</div>` +
        (vibeShort
          ? `<div style="font-size:15px;color:#4A6274;font-style:italic">&ldquo;${escapeHtml(vibeShort)}&rdquo;</div>`
          : "") +
        `<div style="font-size:14px;color:#E8614D;font-weight:600;margin-top:6px">&rarr; ${escapeHtml(dealHook(v))}</div>` +
        `</a>`
      );
    })
    .join("\n");

  const nearbyTowns = (siblingTowns || [])
    .filter((t) => t.slug !== town.slug)
    .slice(0, 16)
    .map(
      (t) =>
        `<a href="${escapeAttr(canonicalTownPath(t.slug))}" style="padding:10px 18px;border-radius:24px;border:1.5px solid #D8E2EA;background:#fff;color:#4A6274;font-size:15px;font-weight:500;text-decoration:none;display:inline-block">${escapeHtml(t.name)} (${t.withHours.length})</a>`
    )
    .join("\n");

  const blogHref = regionMeta?.blog || "";
  const blogBlock = blogHref
    ? `<div style="margin:28px 0 8px;padding:16px 18px;background:#EFF6FF;border:1.5px solid #BFDBFE;border-radius:12px;font-size:16px;line-height:1.5">
<strong>Region guide:</strong> <a href="${escapeAttr(blogHref)}" style="color:#E8614D;font-weight:700">Read the ${escapeHtml(regionLabel)} happy hour guide</a> for neighborhoods and itineraries.
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
<meta property="og:title" content="${escapeAttr(`Happy Hour in ${name}, Michigan`)}">
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
<div class="bc"><a href="/">Home</a>${
    regionId
      ? ` &rarr; <a href="${escapeAttr(regionPath)}">${escapeHtml(regionLabel)}</a>`
      : ""
  } &rarr; ${escapeHtml(name)}</div>
<div style="margin-bottom:28px">
<h1 class="sf" style="font-size:clamp(28px,5vw,40px);font-weight:800;margin-bottom:10px">Happy Hour in ${escapeHtml(name)}, Michigan</h1>
<p style="font-size:18px;color:#4A6274;line-height:1.6;max-width:640px">Real happy hour hours and drink specials in ${escapeHtml(name)} — bars, breweries, and restaurants you can plan around, not OSM shells without times.</p>
<div style="margin-top:12px;font-size:16px;color:#2D6A8F;font-weight:700">${count} spot${count === 1 ? "" : "s"} with verified hours</div>
<div class="cta-row">
<a class="bt bp" href="${escapeAttr(interactive)}">Filter &amp; map ${escapeHtml(name)}</a>
${
  regionId
    ? `<a class="bt bo" href="${escapeAttr(regionPath)}">Browse ${escapeHtml(regionLabel)} region</a>`
    : ""
}
<a class="bt bo" href="/for-business/?interest=featured&amp;town=${encodeURIComponent(name)}#claim">Own a ${escapeHtml(name)} listing?</a>
</div>
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,380px),1fr));gap:12px;margin-bottom:32px">
${cards}
</div>
${blogBlock}
${
  nearbyTowns
    ? `<h2 class="sf" style="font-size:22px;margin:32px 0 16px">More Michigan Towns</h2>
<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:32px">${nearbyTowns}</div>`
    : ""
}
<div style="text-align:center;margin:32px 0"><a href="/" class="bt bp" style="font-size:18px;padding:16px 32px">&larr; Browse All Happy Hours</a></div>
<footer class="ft"><div class="sf" style="font-size:18px;font-weight:700;color:#2D6A8F;margin-bottom:6px">Michigan Happy Hour Guide</div>Built by <a href="https://solutionstud.io/">Solution Studio</a><br>Visit our sister site, <a href="https://traversecitywinetour.com">Traverse City Wine Tour</a><br>Listings are community-sourced &middot; Hours and deals may change &mdash; <a href="/submit/" style="color:#E8614D">suggest an update</a><br><span style="color:#A8BFCC">&copy; ${new Date().getFullYear()} MichiganHappyHour.com</span></footer>
</div>
<script src="/js/cta-track.js" defer></script>
</body>
</html>`;
}
