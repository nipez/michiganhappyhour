import { parseJsonArray, slugify } from "../api/_venues.js";

const REGION_LABELS = {
  "traverse-city": "Traverse City",
  leelanau: "Leelanau Peninsula",
  "old-mission": "Old Mission Peninsula",
  "elk-rapids": "Elk Rapids & Torch Lake",
  "frankfort-benzie": "Frankfort & Benzie County",
  "charlevoix-petoskey": "Charlevoix & Petoskey",
  "bellaire-mancelona": "Bellaire & Antrim County",
  mackinaw: "Mackinaw City & Mackinac Island",
  "grand-rapids": "Grand Rapids",
  "ann-arbor": "Ann Arbor",
  detroit: "Detroit",
  kalamazoo: "Kalamazoo",
  lansing: "Lansing & East Lansing",
  holland: "Holland",
  muskegon: "Muskegon",
  marquette: "Marquette",
  "tri-cities": "Saginaw / Bay City",
  flint: "Flint"
};

export function venueSlug(row) {
  if (row.spot_path) {
    const base = String(row.spot_path).split("/").pop() || "";
    if (base.endsWith(".html")) return base.slice(0, -5);
    if (base) return base;
  }
  return slugify(row.name, row.town);
}

export function canonicalSpotPath(row) {
  return `/spots/${venueSlug(row)}.html`;
}

export function normalizeSpotSlug(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  s = s.split("/").filter(Boolean).pop() || s;
  if (s.endsWith(".html")) s = s.slice(0, -5);
  return s.toLowerCase();
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

export function renderSpotPage(venue, related = []) {
  const name = venue.name || "Happy Hour";
  const town = venue.town || "";
  const address = venue.address || "";
  const category = venue.category || "Restaurant";
  const phone = venue.phone || "";
  const vibe = venue.vibe || "";
  const hhStart = venue.hh_start || "";
  const hhEnd = venue.hh_end || "";
  const days = parseJsonArray(venue.hh_days);
  const deals = parseJsonArray(venue.deals);
  const lat = venue.lat;
  const lng = venue.lng;
  const region = venue.region || "";
  const regionLabel = venue.region_name || REGION_LABELS[region] || town;
  const slug = venueSlug(venue);
  const canonical = `https://michiganhappyhour.com/spots/${slug}.html`;
  const leadDeal = deals[0] || "Happy hour specials";
  const hoursLine = [hhStart, hhEnd].filter(Boolean).join("-");
  const desc = `${name} happy hour: ${hoursLine}. ${leadDeal}`.slice(0, 160);
  const title = `${name} Happy Hour in ${town}, MI | Michigan Happy Hour Guide`;
  const ogTitle = `${name} Happy Hour in ${town}, MI`;
  const daysText = days.join(", ");
  const hoursDisplay = [hhStart, hhEnd].filter(Boolean).join(" &ndash; ");

  const submitParams = new URLSearchParams({
    name,
    town,
    address,
    category,
    hours: `${daysText} ${hhStart} – ${hhEnd}`.trim(),
    deals: deals.join(", ")
  });

  const mapsQuery = encodeURIComponent([name, address, town, "MI"].filter(Boolean).join(" "));
  const mapsSearch = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const mapEmbed =
    lat != null && lng != null
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=15&output=embed`
      : `https://www.google.com/maps?q=${mapsQuery}&z=15&output=embed`;

  const ld = {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name,
    description: vibe || desc,
    address: {
      "@type": "PostalAddress",
      streetAddress: address,
      addressLocality: town,
      addressRegion: "MI",
      addressCountry: "US"
    },
    geo:
      lat != null && lng != null
        ? { "@type": "GeoCoordinates", latitude: lat, longitude: lng }
        : undefined,
    telephone: phone || undefined
  };
  if (!ld.geo) delete ld.geo;
  if (!ld.telephone) delete ld.telephone;

  const dealsHtml = deals.length
    ? deals
        .map(
          (d) =>
            `<div class="di"><span class="da">&rarr;</span><span>${escapeHtml(d)}</span></div>`
        )
        .join("\n")
    : `<div class="di"><span class="da">&rarr;</span><span>Call for current specials</span></div>`;

  const relatedHtml = related.length
    ? related
        .map((r) => {
          const href = canonicalSpotPath(r);
          const rHours = [r.hh_start, r.hh_end].filter(Boolean).join("&ndash;");
          return (
            `<a href="${escapeAttr(href)}" class="nc">` +
            `<div style="font-weight:700;font-size:17px;color:#1B2838;margin-bottom:4px">${escapeHtml(r.name)}</div>` +
            `<div style="font-size:14px;color:#6B8A9E;margin-bottom:4px">${escapeHtml(r.town)}${r.address ? " &middot; " + escapeHtml(r.address) : ""}</div>` +
            `<div style="font-size:14px;color:#2D6A8F;font-weight:600">${rHours || "Happy hour"}</div>` +
            `</a>`
          );
        })
        .join("\n")
    : "";

  const phoneBtn = phone
    ? `<a href="tel:${escapeAttr(phone)}" class="bt bo">&#x1F4DE; ${escapeHtml(phone)}</a>`
    : "";

  const featuredBadge = venue.featured
    ? `<span class="bg" style="background:#FFF0ED;color:#E8614D;margin-left:8px">Featured</span>`
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
<meta property="og:title" content="${escapeAttr(ogTitle)}">
<meta property="og:description" content="${escapeAttr(desc)}">
<meta property="og:image" content="https://michiganhappyhour.com/img/hero.jpg">
<meta property="og:site_name" content="Michigan Happy Hour Guide">
<link rel="canonical" href="${escapeAttr(canonical)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeAttr(title)}">
<meta name="twitter:description" content="${escapeAttr(desc)}">
<meta name="twitter:image" content="https://michiganhappyhour.com/img/hero.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',-apple-system,sans-serif;background:#F5F7FA;color:#1B2838;-webkit-font-smoothing:antialiased}.sf{font-family:'Playfair Display',Georgia,serif}a{color:#2D6A8F;text-decoration:none}a:hover{color:#E8614D}.w{max-width:800px;margin:0 auto;padding:0 20px}.bc{padding:16px 0;font-size:15px;color:#8AA3B5}.bc a{color:#6B8A9E}.hb{background:linear-gradient(135deg,#1B2838,#2D4A5E);padding:20px 0}.hb .w{display:flex;align-items:center;justify-content:space-between}.hb a{color:#E8614D;font-weight:700;font-size:18px}.hb .sn{color:#fff;font-size:20px;font-weight:700}.cd{background:#fff;border-radius:16px;border:1.5px solid #D8E2EA;padding:28px;margin-bottom:20px;box-shadow:0 2px 12px rgba(45,106,143,0.06)}.bg{display:inline-block;padding:5px 14px;border-radius:20px;font-size:15px;font-weight:600}.di{display:flex;align-items:flex-start;gap:8px;margin-bottom:6px;font-size:17px;line-height:1.5}.da{color:#E8614D;font-weight:700;flex-shrink:0}.bt{display:inline-flex;align-items:center;gap:6px;padding:14px 24px;border-radius:12px;font-weight:700;font-size:16px;text-decoration:none}.bp{background:linear-gradient(135deg,#2D6A8F,#E8614D);color:#fff}.bo{background:#F5F7FA;border:2px solid #D8E2EA;color:#4A6274}.nc{display:block;background:#fff;border-radius:12px;border:1.5px solid #D8E2EA;padding:16px 18px;transition:all 0.2s;text-decoration:none;color:inherit}.nc:hover{border-color:#E8614D;box-shadow:0 4px 16px rgba(232,97,77,0.1)}.ft{border-top:2px solid #D8E2EA;padding:32px 0;text-align:center;margin-top:40px;color:#8AA3B5;font-size:15px;line-height:2}.me{border-radius:12px;overflow:hidden;margin:20px 0;border:1.5px solid #D8E2EA}@media(max-width:600px){.w{padding:0 16px}.cd{padding:20px 18px}}</style>
</head>
<body>
<div class="hb"><div class="w"><a href="/" class="sn">🥂 Michigan Happy Hour</a><a href="/">&larr; All Spots</a></div></div>
<div class="w">
<div class="bc"><a href="/">Home</a> &rarr; <a href="/regions/${escapeAttr(region)}.html">${escapeHtml(regionLabel)}</a> &rarr; ${escapeHtml(name)}</div>
<div class="cd">
<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px">
<div>
<h1 class="sf" style="font-size:clamp(28px,5vw,36px);font-weight:800;margin-bottom:6px">${escapeHtml(name)}</h1>
<div style="font-size:17px;color:#6B8A9E">${escapeHtml(town)}, MI${address ? " &middot; " + escapeHtml(address) : ""}</div>
</div>
<span class="bg" style="background:#EFF6FF;color:#2D6A8F">${escapeHtml(category)}</span>${featuredBadge}
</div>
<div style="background:linear-gradient(135deg,#EFF6FF,#F5F7FA);border-radius:12px;padding:20px;margin-bottom:20px">
<div style="font-size:14px;font-weight:700;color:#8AA3B5;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">Happy Hour</div>
<div style="font-size:24px;font-weight:800;color:#E8614D">${hoursDisplay || "See listing"}</div>
<div style="font-size:16px;color:#4A6274;margin-top:4px">${escapeHtml(daysText)}</div>
</div>
${vibe ? `<p style="font-size:18px;color:#4A6274;font-style:italic;line-height:1.6;margin-bottom:20px">&ldquo;${escapeHtml(vibe)}&rdquo;</p>` : ""}
<div style="margin-bottom:20px">
<div style="font-size:14px;font-weight:700;color:#8AA3B5;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px">Deals &amp; Specials</div>
${dealsHtml}
</div>
<div style="margin-top:14px;padding:10px 14px;background:#FFF8F0;border-radius:8px;border:1px solid #F0E0D0;font-size:13px;color:#8A7560;line-height:1.5">📋 Hours &amp; specials may vary. Call ahead to confirm, or <a href="/submit/?${submitParams.toString()}" style="color:#E8614D;font-weight:600">suggest an update</a> if something's changed.</div>
<div style="display:flex;flex-wrap:wrap;gap:12px">
${phoneBtn}
<a href="${escapeAttr(mapsSearch)}" target="_blank" rel="noopener" class="bt bp">&#x1F4CD; Get Directions</a>
</div>
</div>
<div class="me"><iframe src="${escapeAttr(mapEmbed)}" width="100%" height="300" style="border:0" allowfullscreen loading="lazy"></iframe></div>
${
  relatedHtml
    ? `<h2 class="sf" style="font-size:22px;margin:32px 0 16px">More Happy Hours in ${escapeHtml(regionLabel)}</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:12px">${relatedHtml}</div>`
    : ""
}
<div style="text-align:center;margin:32px 0"><a href="/" class="bt bp" style="font-size:18px;padding:16px 32px">&larr; Browse All Happy Hours</a></div>
<footer class="ft"><div class="sf" style="font-size:18px;font-weight:700;color:#2D6A8F;margin-bottom:6px">Michigan Happy Hour Guide</div>A companion to <a href="https://traversecitywinetour.com">Traverse City Wine Tour</a><br>Listings are community-sourced &middot; Hours and deals may change &mdash; <a href="/submit/" style="color:#E8614D">suggest an update</a><br><span style="color:#A8BFCC">&copy; 2026 Traverse City Wine Tour</span></footer>
</div>
<script src="/js/cta-track.js" defer></script>
</body>
</html>`;
}
