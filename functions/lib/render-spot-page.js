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
  flint: "Flint",
  "port-huron": "Port Huron & Thumb",
  jackson: "Jackson",
  "battle-creek": "Battle Creek",
  "southwest-mi": "SW Michigan",
  "monroe-adrian": "Monroe & Adrian",
  "mount-pleasant": "Mount Pleasant",
  cadillac: "Cadillac",
  "west-shore": "Ludington & Manistee",
  "northeast-mi": "Northeast Michigan",
  "up-west": "Western UP",
  "up-east": "Eastern UP",
  livingston: "Brighton & Howell",
  "south-central": "South Central Michigan",
  "west-central": "West Central Michigan"
};

/** City / theme guides for internal linking from spot PDPs */
const REGION_GUIDES = {
  "traverse-city": { href: "/blog/traverse-city-happy-hour-guide", label: "Traverse City happy hour guide" },
  "grand-rapids": { href: "/blog/grand-rapids-happy-hour-guide", label: "Grand Rapids happy hour guide" },
  "ann-arbor": { href: "/blog/ann-arbor-happy-hour-guide", label: "Ann Arbor happy hour guide" },
  detroit: { href: "/blog/detroit-happy-hour-guide", label: "Detroit happy hour guide" },
  kalamazoo: { href: "/blog/kalamazoo-happy-hour-guide", label: "Kalamazoo happy hour guide" },
  lansing: { href: "/blog/lansing-happy-hour-guide", label: "Lansing happy hour guide" },
  holland: { href: "/blog/holland-happy-hour-guide", label: "Holland happy hour guide" },
  muskegon: { href: "/blog/muskegon-happy-hour-guide", label: "Muskegon happy hour guide" },
  marquette: { href: "/blog/marquette-happy-hour-guide", label: "Marquette happy hour guide" },
  flint: { href: "/blog/flint-happy-hour-guide", label: "Flint happy hour guide" },
  "tri-cities": { href: "/blog/tri-cities-happy-hour-guide", label: "Tri-Cities happy hour guide" },
  "port-huron": { href: "/blog/port-huron-happy-hour-guide", label: "Port Huron happy hour guide" },
  "charlevoix-petoskey": {
    href: "/blog/charlevoix-petoskey-happy-hour-guide",
    label: "Petoskey & Charlevoix happy hour guide"
  },
  "up-west": { href: "/blog/upper-peninsula-happy-hour-road-trip", label: "UP happy hour road trip" },
  "up-east": { href: "/blog/upper-peninsula-happy-hour-road-trip", label: "UP happy hour road trip" }
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
  // Cloudflare Pages serves extensionless URLs; keep public paths bare.
  return `/spots/${venueSlug(row)}`;
}

function isPlaceholderDeal(d) {
  const s = String(d || "").toLowerCase();
  if (!s) return true;
  return (
    s.includes("ask about today") ||
    s.includes("call for current") ||
    s.includes("not verified") ||
    s.includes("call ahead")
  );
}

function verifiedDeals(deals) {
  return deals.map((d) => String(d || "").trim()).filter((d) => d && !isPlaceholderDeal(d));
}

/** Compact deal hook for titles (keep SERP titles readable). */
function dealHook(deals) {
  const first = (verifiedDeals(deals)[0] || "").trim();
  if (!first) return "";
  // Prefer short price-led hooks
  const short = first.replace(/\s+/g, " ");
  return short.length <= 42 ? short : short.slice(0, 39).replace(/\s+\S*$/, "") + "…";
}

function buildSpotSeo(name, town, hhStart, hhEnd, deals, category = "") {
  const hoursLine = [hhStart, hhEnd].filter(Boolean).join("–");
  const realDeals = verifiedDeals(deals);
  const hasHours = Boolean(hhStart && hhEnd);
  const cat = (category || "spot").toLowerCase();
  const hook = dealHook(deals);
  const year = new Date().getFullYear();

  // CTR-first titles: lead with hours/deals when we have them; otherwise local intent.
  let title;
  const withHours = `${name} Happy Hour ${hoursLine} | ${town}`;
  const withHook = `${name} Happy Hour | ${hook}`;
  const withTown = `${name} Happy Hour | ${town}, MI`;
  const nearMe = `Happy Hour at ${name} | ${town}, MI`;
  if (hasHours && withHours.length <= 60) {
    title = withHours;
  } else if (hook && withHook.length <= 60) {
    title = withHook;
  } else if (withTown.length <= 60) {
    title = withTown;
  } else if (nearMe.length <= 60) {
    title = nearMe;
  } else {
    title = `${name} Happy Hour | ${town}`;
  }

  let desc;
  if (realDeals.length && hasHours) {
    desc = `${realDeals.slice(0, 3).join(", ")} at ${name} — happy hour ${hoursLine} in ${town}, MI. Updated ${year}: hours, specials, map & directions.`;
  } else if (hasHours) {
    desc = `${name} happy hour runs ${hoursLine} in ${town}, MI. See current ${cat} specials, map pin, and directions — updated ${year}.`;
  } else {
    desc = `Happy hour at ${name} in ${town}, MI — location, map, phone, and how to confirm today's ${cat} drink specials. Updated ${year}.`;
  }
  desc = desc.slice(0, 160);

  const ogTitle = hasHours
    ? `${name} Happy Hour ${hoursLine} | ${town}, MI`
    : `${name} Happy Hour | ${town}, MI`;
  return { title, desc, ogTitle, hasVerifiedDeals: realDeals.length > 0, hasHours };
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
  const website = venue.website || "";
  const openingHours = venue.opening_hours || "";
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
  const canonical = `https://michiganhappyhour.com/spots/${slug}`;
  const seo = buildSpotSeo(name, town, hhStart, hhEnd, deals, category);
  const { title, desc, ogTitle } = seo;
  const daysText = days.join(", ");
  const hoursDisplay = [hhStart, hhEnd].filter(Boolean).join(" &ndash; ");
  const realDeals = verifiedDeals(deals);
  const showPlaceholderDeals = !realDeals.length;
  const websiteHref = website
    ? /^https?:\/\//i.test(website)
      ? website
      : `https://${website}`
    : "";

  const submitParams = new URLSearchParams({
    name,
    town,
    address,
    category,
    hours: `${daysText} ${hhStart} – ${hhEnd}`.trim(),
    deals: realDeals.join(", ")
  });
  const claimParams = new URLSearchParams({
    name,
    town,
    interest: venue.featured ? "claim" : "featured",
    hours: hoursDisplay
      ? `${daysText} ${hhStart} – ${hhEnd}`.trim()
      : "see current listing",
    deals: realDeals.length ? realDeals.slice(0, 3).join("; ") : "see current listing"
  });
  if (website) claimParams.set("website", website);
  if (phone) claimParams.set("phone", phone);

  const aboutBits = [
    `${name} is a ${String(category || "happy hour spot").toLowerCase()} in ${town}, Michigan`,
    address ? `at ${address}` : null,
    regionLabel ? `in the ${regionLabel} area` : null
  ].filter(Boolean);
  let about =
    aboutBits[0] +
    (aboutBits[1] ? ` ${aboutBits[1]}` : "") +
    (aboutBits[2] ? `, ${aboutBits[2]}` : "") +
    ".";
  if (seo.hasHours) {
    about += ` Happy hour runs ${hhStart}–${hhEnd}${days.length ? ` (${days.length === 7 ? "every day" : days.length + " days/week"})` : ""}.`;
  } else if (openingHours) {
    about += ` Business hours are listed as ${openingHours}. Happy hour specials can change — call or stop in to confirm what's pouring today.`;
  } else {
    about += ` Hours and drink specials can change — call or stop in to confirm what's pouring today.`;
  }
  if (vibe && !/midweek pour|openstreetmap|not verified|auto-discovered/i.test(vibe)) {
    about += ` ${vibe.replace(/^["“]|["”]$/g, "")}`;
    if (!/[.!?]$/.test(about.trim())) about += ".";
  }

  const mapsQuery = encodeURIComponent([name, address, town, "MI"].filter(Boolean).join(" "));
  const mapsSearch = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const mapEmbed =
    lat != null && lng != null
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=15&output=embed`
      : `https://www.google.com/maps?q=${mapsQuery}&z=15&output=embed`;

  const schemaType = (() => {
    const c = String(category || "").toLowerCase();
    if (c.includes("brew")) return "Brewery";
    if (c.includes("wine") || c.includes("winery") || c.includes("cidery")) return "Winery";
    if (c.includes("distill")) return "Distillery";
    if (c.includes("cocktail") || c.includes("taproom") || c.includes("bar") || c.includes("pub"))
      return "BarOrPub";
    return "Restaurant";
  })();

  const ld = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name,
    description: vibe || desc,
    url: canonical,
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
    telephone: phone || undefined,
    sameAs: websiteHref || undefined,
    openingHours: openingHours || undefined
  };
  if (!ld.geo) delete ld.geo;
  if (!ld.telephone) delete ld.telephone;
  if (!ld.sameAs) delete ld.sameAs;
  if (!ld.openingHours) delete ld.openingHours;

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://michiganhappyhour.com/" },
      {
        "@type": "ListItem",
        position: 2,
        name: regionLabel,
        item: `https://michiganhappyhour.com/regions/${region}`
      },
      { "@type": "ListItem", position: 3, name, item: canonical }
    ]
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `What time is happy hour at ${name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: seo.hasHours
            ? `Happy hour at ${name} in ${town} runs ${hhStart}–${hhEnd}${daysText ? ` on ${daysText}` : ""}. Hours can change — call ahead to confirm.`
            : `Happy hour hours at ${name} in ${town} are not verified yet. Call ahead or check their website for today's specials window.`
        }
      },
      {
        "@type": "Question",
        name: `What are the happy hour deals at ${name}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: realDeals.length
            ? `${name} happy hour specials include: ${realDeals.slice(0, 4).join("; ")}.`
            : `${name} posts rotating drink and food specials. Ask your server about today's happy hour menu when you arrive.`
        }
      },
      {
        "@type": "Question",
        name: `Where is ${name} located?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: address
            ? `${name} is at ${address}, ${town}, MI.`
            : `${name} is in ${town}, Michigan${regionLabel ? ` (${regionLabel})` : ""}.`
        }
      }
    ]
  };

  const dealsHtml = realDeals.length
    ? realDeals
        .map(
          (d) =>
            `<div class="di"><span class="da">&rarr;</span><span>${escapeHtml(d)}</span></div>`
        )
        .join("\n")
    : `<div class="di"><span class="da">&rarr;</span><span>Ask about today&rsquo;s drink &amp; food specials</span></div>`;

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

  const trackBase = JSON.stringify({
    id: venue.id || slug,
    name,
    town,
    page_type: "spot",
    source: "spot_pdp"
  });
  const claimTrack = JSON.stringify({
    id: venue.id || slug,
    name,
    town,
    page_type: "spot",
    source: "spot_claim_cta"
  });

  const phoneBtn = phone
    ? `<a href="tel:${escapeAttr(phone)}" class="bt bo" data-cta="cta_call" onclick='window.trackCta&&window.trackCta("cta_call",${trackBase})'>&#x1F4DE; ${escapeHtml(phone)}</a>`
    : "";
  const websiteBtn = websiteHref
    ? `<a href="${escapeAttr(websiteHref)}" target="_blank" rel="noopener" class="bt bo" onclick='window.trackCta&&window.trackCta("cta_website",${trackBase})'>&#x1F310; Website</a>`
    : "";

  const claimedBadge = venue.claimed
    ? `<span class="bg" style="background:#ECFDF5;color:#059669">Verified</span>`
    : "";
  const featuredBadge = venue.featured
    ? `<span class="bg" style="background:#FFF0ED;color:#E8614D">Featured</span>`
    : "";
  const dogBadge = venue.dog_friendly
    ? `<span class="bg" style="background:#FFF7ED;color:#C2410C">Dog friendly</span>`
    : "";
  const claimCtaTitle = venue.claimed
    ? `Update ${escapeHtml(name)}`
    : `Claim or feature ${escapeHtml(name)}`;
  const claimCtaBody = venue.claimed
    ? `This listing is verified. Request a Featured slot ($79/mo) for priority placement in ${escapeHtml(regionLabel)}, or send updated specials anytime.`
    : `Update specials anytime, get monthly call/directions stats, and optionally take priority placement in ${escapeHtml(regionLabel)}.`;
  const claimCtaLabel = venue.claimed
    ? "Request Featured / send update"
    : "Claim / feature this listing";
  const openHoursBlock =
    !hoursDisplay && openingHours
      ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid #D8E2EA">
<div style="font-size:13px;font-weight:700;color:#8AA3B5;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Business hours</div>
<div style="font-size:15px;color:#4A6274;line-height:1.45">${escapeHtml(openingHours)}</div>
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
<meta property="og:title" content="${escapeAttr(ogTitle)}">
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
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
<script type="application/ld+json">${JSON.stringify(faqLd)}</script>
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
.badges{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.hh{background:linear-gradient(135deg,#EFF6FF,#F5F7FA);border-radius:12px;padding:20px;margin-bottom:20px}
.di{display:flex;align-items:flex-start;gap:8px;margin-bottom:6px;font-size:17px;line-height:1.5}
.da{color:#E8614D;font-weight:700;flex-shrink:0}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0 16px}
.bt{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 22px;border-radius:12px;font-weight:700;font-size:16px;text-decoration:none;flex:1 1 180px;min-height:52px;transition:opacity .15s,transform .15s}
.bt:hover{opacity:.92;transform:translateY(-1px)}
.bp{background:linear-gradient(135deg,#2D6A8F,#E8614D);color:#fff}
.bo{background:#F5F7FA;border:2px solid #D8E2EA;color:#4A6274}
.note{margin:0;padding:12px 14px;background:#FFF8F0;border-radius:10px;border:1px solid #F0E0D0;font-size:13px;color:#8A7560;line-height:1.55}
.note a{color:#E8614D;font-weight:600}
.nc{display:block;background:#fff;border-radius:12px;border:1.5px solid #D8E2EA;padding:16px 18px;transition:all 0.2s;text-decoration:none;color:inherit}
.nc:hover{border-color:#E8614D;box-shadow:0 4px 16px rgba(232,97,77,0.1)}
.ft{border-top:2px solid #D8E2EA;padding:32px 0;text-align:center;margin-top:40px;color:#8AA3B5;font-size:15px;line-height:2}
.me{border-radius:12px;overflow:hidden;margin:8px 0 20px;border:1.5px solid #D8E2EA}
.map-label{font-size:14px;font-weight:700;color:#8AA3B5;text-transform:uppercase;letter-spacing:1.5px;margin:8px 0 10px}
@media(max-width:600px){
  .w{padding:0 16px}
  .cd{padding:20px 18px}
  .actions{flex-direction:column;margin-top:20px}
  .bt{flex:1 1 auto;width:100%}
}
</style>
</head>
<body>
<div class="hb"><div class="w"><a href="/" class="sn">🥂 Michigan Happy Hour</a><a href="/">&larr; All Spots</a></div></div>
<div class="w">
<div class="bc"><a href="/">Home</a> &rarr; <a href="/regions/${escapeAttr(region)}">${escapeHtml(regionLabel)}</a> &rarr; ${escapeHtml(name)}</div>
<div class="cd">
<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px">
<div>
<h1 class="sf" style="font-size:clamp(28px,5vw,36px);font-weight:800;margin-bottom:6px">${escapeHtml(name)} Happy Hour</h1>
<div style="font-size:17px;color:#6B8A9E">${escapeHtml(town)}, MI${address ? " &middot; " + escapeHtml(address) : ""}</div>
</div>
<div class="badges"><span class="bg" style="background:#EFF6FF;color:#2D6A8F">${escapeHtml(category)}</span>${claimedBadge}${featuredBadge}${dogBadge}</div>
</div>
<div class="hh">
<div style="font-size:14px;font-weight:700;color:#8AA3B5;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">Happy Hour</div>
<div style="font-size:24px;font-weight:800;color:#E8614D">${hoursDisplay || "Hours TBD — call ahead"}</div>
${hoursDisplay && daysText ? `<div style="font-size:16px;color:#4A6274;margin-top:4px">${escapeHtml(daysText)}</div>` : ""}
${openHoursBlock}
</div>
<p style="font-size:17px;color:#4A6274;line-height:1.65;margin:0 0 20px">${escapeHtml(about)}</p>
${
  vibe && !/midweek pour|openstreetmap|not verified|auto-discovered/i.test(vibe)
    ? `<p style="font-size:18px;color:#4A6274;font-style:italic;line-height:1.6;margin-bottom:20px">&ldquo;${escapeHtml(vibe)}&rdquo;</p>`
    : ""
}
<div style="margin-bottom:4px">
<div style="font-size:14px;font-weight:700;color:#8AA3B5;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px">Deals &amp; Specials</div>
${dealsHtml}
${
  showPlaceholderDeals
    ? `<p style="font-size:14px;color:#8AA3B5;margin-top:8px;line-height:1.5">Know the current specials? <a href="/submit/?${submitParams.toString()}">Send an update</a>${REGION_GUIDES[region] ? ` or browse the <a href="${escapeAttr(REGION_GUIDES[region].href)}">${escapeHtml(REGION_GUIDES[region].label)}</a>` : ""} — help fellow Michigan drinkers.</p>`
    : ""
}
</div>
<div class="actions">
${phoneBtn}
${websiteBtn}
<a href="${escapeAttr(mapsSearch)}" target="_blank" rel="noopener" class="bt bp" onclick='window.trackCta&&window.trackCta("cta_directions",${trackBase})'>&#x1F4CD; Get Directions</a>
</div>
<p class="note">Hours &amp; specials may vary. Call ahead to confirm, or <a href="/submit/?${submitParams.toString()}">suggest an update</a> if something&rsquo;s changed.</p>
</div>
<div class="cd" style="margin-top:16px;background:linear-gradient(135deg,#FFF8F3,#EFF6FF);border-color:#F0D0C4">
<div style="font-size:14px;font-weight:700;color:#8AA3B5;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">${venue.claimed ? "Owner tools" : "Own this spot?"}</div>
<div class="sf" style="font-size:22px;font-weight:700;color:#1B2838;margin-bottom:8px">${claimCtaTitle}</div>
<p style="font-size:16px;color:#4A6274;line-height:1.55;margin:0 0 14px;max-width:42ch">${claimCtaBody}</p>
<div class="actions" style="margin-top:0">
<a href="/for-business/?${claimParams.toString()}#claim" class="bt bp" onclick='window.trackCta&&window.trackCta("cta_claim",${claimTrack})'>${claimCtaLabel}</a>
<a href="/submit/?${submitParams.toString()}" class="bt bo">Suggest a free update</a>
</div>
</div>
<div class="map-label">Location</div>
<div class="me"><iframe src="${escapeAttr(mapEmbed)}" width="100%" height="300" style="border:0" allowfullscreen loading="lazy" title="Map of ${escapeAttr(name)}"></iframe></div>
${
  relatedHtml
    ? `<h2 class="sf" style="font-size:22px;margin:32px 0 16px">More Happy Hours in ${escapeHtml(regionLabel)}</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:12px">${relatedHtml}</div>`
    : ""
}
${(() => {
  const guide = REGION_GUIDES[region];
  const links = [
    guide
      ? `<a href="${escapeAttr(guide.href)}" style="display:block;padding:14px 16px;border-radius:12px;border:1.5px solid #D8E2EA;background:#fff;text-decoration:none;font-weight:700;color:#1B2838;font-size:15px">${escapeHtml(guide.label)} →</a>`
      : "",
    `<a href="/blog/cheap-happy-hour-deals-michigan" style="display:block;padding:14px 16px;border-radius:12px;border:1.5px solid #D8E2EA;background:#fff;text-decoration:none;font-weight:700;color:#1B2838;font-size:15px">Best cheap ($5 &amp; under) deals →</a>`,
    `<a href="/blog/waterfront-patio-happy-hours-michigan" style="display:block;padding:14px 16px;border-radius:12px;border:1.5px solid #D8E2EA;background:#fff;text-decoration:none;font-weight:700;color:#1B2838;font-size:15px">Waterfront &amp; patio happy hours →</a>`,
    `<a href="/blog/" style="display:block;padding:14px 16px;border-radius:12px;border:1.5px solid #D8E2EA;background:#fff;text-decoration:none;font-weight:700;color:#1B2838;font-size:15px">All guides &amp; tips →</a>`
  ]
    .filter(Boolean)
    .join("");
  return `<h2 class="sf" style="font-size:22px;margin:32px 0 16px">Guides &amp; tips</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr));gap:10px">${links}</div>`;
})()}
<div class="actions" style="justify-content:center;margin:32px 0">
<a href="/regions/${escapeAttr(region)}" class="bt bo" style="flex:0 1 260px">Explore ${escapeHtml(regionLabel)}</a>
<a href="/" class="bt bp" style="flex:0 1 260px">&larr; All Happy Hours</a>
</div>
<footer class="ft"><div class="sf" style="font-size:18px;font-weight:700;color:#2D6A8F;margin-bottom:6px">Michigan Happy Hour Guide</div>Built by <a href="https://solutionstud.io/">Solution Studio</a><br>Visit our sister site, <a href="https://traversecitywinetour.com">Traverse City Wine Tour</a><br>Listings are community-sourced &middot; Hours and deals may change &mdash; <a href="/submit/" style="color:#E8614D">suggest an update</a><br><span style="color:#A8BFCC">&copy; 2026 MichiganHappyHour.com</span></footer>
</div>
<script src="/js/cta-track.js" defer></script>
</body>
</html>`;
}
