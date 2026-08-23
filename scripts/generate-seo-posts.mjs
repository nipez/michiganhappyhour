#!/usr/bin/env node
/**
 * Generate 8 SEO blog HTML posts in /blog/
 *
 * Usage: node scripts/generate-seo-posts.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const blogDir = path.join(root, "blog");
const DATE = "2026-08-23";

/** Spots not yet in region cards or index partial listings */
const MANUAL_VENUES = {
  "refined-fool-brewing-co-port-huron-thumb": {
    name: "Refined Fool Brewing Co.",
    unverified: true,
    deals: "Ask about today's drink & food specials",
    vibe: "Port Huron craft brewery on the St. Clair River",
  },
  "the-tin-fiddler-port-huron-thumb": {
    name: "The Tin Fiddler",
    unverified: true,
    deals: "Ask about today's drink & food specials",
    vibe: "Waterfront bar and live music on the Blue Water shore",
  },
  "piccadilly-bar-grill-port-huron-thumb": {
    name: "Piccadilly Bar & Grill",
    unverified: true,
    deals: "Ask about today's drink & food specials",
    vibe: "Classic Port Huron neighborhood grill and bar",
  },
  "harp-bar-and-grill-sault-ste-marie": {
    name: "Harp Bar & Grill",
    unverified: true,
    deals: "Ask about today's drink & food specials",
    vibe: "Sault Ste. Marie bar and grill near the locks",
  },
  "upper-hand-brewery-escanaba": {
    name: "Upper Hand Brewery",
    unverified: true,
    deals: "Ask about today's drink & food specials",
    vibe: "Escanaba craft brewery in Michigan's Upper Peninsula",
  },
};

export const BLOG_SLUGS = [
  "tri-cities-happy-hour-guide",
  "port-huron-happy-hour-guide",
  "charlevoix-petoskey-happy-hour-guide",
  "waterfront-patio-happy-hours-michigan",
  "cheap-happy-hour-deals-michigan",
  "sunday-happy-hour-michigan",
  "college-town-happy-hours-michigan",
  "upper-peninsula-happy-hour-road-trip",
];

function extractMapSpots(html) {
  const key = "var SPOTS = ";
  const start = html.indexOf(key);
  if (start < 0) return {};
  const from = start + key.length;
  const end = html.indexOf("];", from) + 1;
  const spots = JSON.parse(html.slice(from, end));
  const bySlug = {};
  for (const s of spots) {
    if (!s.s) continue;
    const slug = s.s.replace("/spots/", "");
    bySlug[slug] = {
      name: decodeEntities(s.n),
      hours: s.hs && s.he ? `${s.hs}&ndash;${s.he}` : null,
      days: s.dy || null,
      deals: Array.isArray(s.deals) ? s.deals.join(", ") : null,
      vibe: s.v ? decodeEntities(s.v) : null,
    };
  }
  return bySlug;
}

function parseIndexSpots(html) {
  const bySlug = {};
  const re =
    /<strong><a href="\/spots\/([^"]+)">([^<]+)<\/a><\/strong> — ([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    const [, slug, name, rest] = m;
    const hh = rest.match(/Happy hour ([^\.]+)\. (.+)/);
    bySlug[slug] = {
      name: decodeEntities(name),
      hours: hh ? hh[1].replace(/–/g, "&ndash;").replace(/-/g, "&ndash;") : null,
      deals: hh ? decodeEntities(hh[2]) : "Ask about today's drink & food specials",
      unverified: !hh,
    };
  }
  return bySlug;
}

function parseRegionCards(html) {
  const bySlug = {};
  const cardRe = /<a href="\/spots\/([^"]+)" class="nc">([\s\S]*?)<\/a>/g;
  let m;
  while ((m = cardRe.exec(html))) {
    const slug = m[1];
    const block = m[2];
    const name = block.match(
      /<div style="font-weight:700;font-size:18px;color:#1B2838">([^<]+)<\/div>/
    )?.[1];
    const hours = block.match(
      /color:#E8614D;white-space:nowrap">([^<]+)<\/div>/
    )?.[1];
    const deal = block.match(/&rarr; ([^<]+)<\/div>/)?.[1];
    const vibe = block.match(/font-style:italic">&ldquo;([\s\S]*?)&rdquo;<\/div>/)?.[1];
    bySlug[slug] = {
      name: name ? decodeEntities(name) : slug,
      hours: hours || null,
      deals: deal ? decodeEntities(deal) : null,
      vibe: vibe ? decodeEntities(vibe) : null,
    };
  }
  return bySlug;
}

function decodeEntities(s) {
  return s
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"');
}

function escapeProse(text) {
  if (!text) return "";
  const plain = decodeEntities(text);
  return plain
    .replace(/&/g, "&amp;")
    .replace(/'/g, "&rsquo;")
    .replace(/–/g, "&ndash;")
    .replace(/—/g, "&mdash;");
}

function buildVenueDb() {
  const db = {};
  const merge = (slug, data) => {
    db[slug] = { ...(db[slug] || {}), ...data, slug };
  };

  mergeAll(extractMapSpots(fs.readFileSync(path.join(root, "map/index.html"), "utf8")), merge);
  mergeAll(parseIndexSpots(fs.readFileSync(path.join(root, "index.html"), "utf8")), merge);
  mergeAll(MANUAL_VENUES, merge);

  const regionsDir = path.join(root, "regions");
  for (const file of fs.readdirSync(regionsDir)) {
    if (!file.endsWith(".html")) continue;
    mergeAll(
      parseRegionCards(fs.readFileSync(path.join(regionsDir, file), "utf8")),
      merge
    );
  }

  return db;
}

function mergeAll(source, merge) {
  for (const [slug, data] of Object.entries(source)) {
    merge(slug, data);
  }
}

function spotHref(slug) {
  return `/spots/${slug}`;
}

function formatHours(v) {
  if (!v.hours) return null;
  const h = v.hours.includes("&ndash;") ? v.hours : v.hours.replace(/–/g, "&ndash;").replace(/-/g, "&ndash;");
  return h;
}

function spotPara(db, slug, suffix = "") {
  const v = db[slug];
  if (!v) {
    console.warn(`Warning: missing venue data for ${slug}`);
    return `<p><a href="${spotHref(slug)}">${escapeProse(slug)}</a>${suffix ? ` ${suffix}` : ""}</p>`;
  }
  const name = escapeProse(v.name);
  const hours = formatHours(v);
  let text = `<p><a href="${spotHref(slug)}">${name}</a>`;
  if (hours && !v.unverified) {
    text += ` runs ${hours}`;
    if (v.deals) text += ` with ${escapeProse(v.deals)}`;
    text += ".";
  } else {
    text += ` &mdash; ${escapeProse(v.deals || "Ask about today's drink & food specials")}.`;
  }
  if (v.vibe) text += ` ${escapeProse(v.vibe)}.`;
  if (suffix) text += ` ${suffix}`;
  text += "</p>";
  return text;
}

function relatedLinks(links) {
  return links
    .map(
      (l) =>
        `<a href="${l.href}" style="display:block;background:#fff;border-radius:12px;border:1.5px solid #D8E2EA;padding:18px 20px;text-decoration:none"><div style="font-size:18px;font-weight:700;color:#1B2838;margin-bottom:4px">${l.title}</div><div style="font-size:15px;color:#6B8A9E">${l.desc}</div></a>`
    )
    .join("\n");
}

function renderPost(post, bodyHtml) {
  const canonical = `https://michiganhappyhour.com/blog/${post.slug}`;
  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    url: canonical,
    datePublished: DATE,
    dateModified: DATE,
    author: { "@type": "Organization", name: "MichiganHappyHour.com" },
    publisher: {
      "@type": "Organization",
      name: "MichiganHappyHour.com",
      url: "https://michiganhappyhour.com",
    },
    image: "https://michiganhappyhour.com/img/hero.jpg",
  });

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
<title>${post.title}</title>
<meta name="description" content="${post.description}">
<meta property="og:title" content="${post.title}">
<meta property="og:description" content="${post.description}">
<meta property="og:image" content="https://michiganhappyhour.com/img/hero.jpg">
<meta property="og:site_name" content="Michigan Happy Hour Guide">
<meta property="og:type" content="article">
<link rel="canonical" href="${canonical}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${post.title}">
<meta name="twitter:description" content="${post.description}">
<meta name="twitter:image" content="https://michiganhappyhour.com/img/hero.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍻</text></svg>">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',-apple-system,sans-serif;background:#F5F7FA;color:#1B2838;-webkit-font-smoothing:antialiased}.sf{font-family:'Playfair Display',Georgia,serif}a{color:#2D6A8F;text-decoration:none}a:hover{color:#E8614D}.w{max-width:800px;margin:0 auto;padding:0 20px}.bc{padding:16px 0;font-size:15px;color:#8AA3B5}.bc a{color:#6B8A9E}.hb{background:linear-gradient(135deg,#1B2838,#2D4A5E);padding:20px 0}.hb .w{display:flex;align-items:center;justify-content:space-between}.hb a{color:#E8614D;font-weight:700;font-size:18px}.hb .sn{color:#fff;font-size:20px;font-weight:700}.cd{background:#fff;border-radius:16px;border:1.5px solid #D8E2EA;padding:28px;margin-bottom:20px;box-shadow:0 2px 12px rgba(45,106,143,0.06)}.bt{display:inline-flex;align-items:center;gap:6px;padding:14px 24px;border-radius:12px;font-weight:700;font-size:16px;text-decoration:none}.bp{background:linear-gradient(135deg,#2D6A8F,#E8614D);color:#fff}.ft{border-top:2px solid #D8E2EA;padding:32px 0;text-align:center;margin-top:40px;color:#8AA3B5;font-size:15px;line-height:2}@media(max-width:600px){.w{padding:0 16px}.cd{padding:20px 18px}}
.prose{font-size:18px;color:#4A6274;line-height:1.8}.prose h2{font-family:'Playfair Display',Georgia,serif;font-size:28px;font-weight:700;color:#1B2838;margin:36px 0 14px}.prose p{margin-bottom:16px}.prose a{color:#E8614D;font-weight:600}
</style>
<script type="application/ld+json">${ld}</script>
</head>
<body>
<div class="hb"><div class="w"><a href="/" class="sn">🥂 Michigan Happy Hour</a><a href="/">&larr; All Spots</a></div></div>
<div class="w">
<div class="bc"><a href="/">Home</a> &rarr; <a href="/blog/">Blog</a> &rarr; ${post.breadcrumb}</div>
<article class="cd" style="max-width:700px;margin:0 auto 40px">
<div style="margin-bottom:24px">
<h1 class="sf" style="font-size:clamp(26px,5vw,36px);font-weight:800;line-height:1.2;margin-bottom:10px">${post.h1}</h1>
<div style="font-size:15px;color:#8AA3B5">Updated August 2026 &middot; MichiganHappyHour.com</div>
</div>
<div class="prose">
${bodyHtml}
</div>
</article>
<div style="max-width:700px;margin:0 auto 40px">
<div class="sf" style="font-size:22px;font-weight:700;color:#1B2838;margin-bottom:16px">More from the Blog</div>
<div style="display:grid;gap:12px">
${relatedLinks(post.related)}
</div>
</div>
<div style="text-align:center;margin:32px 0"><a href="/" class="bt bp" style="font-size:18px;padding:16px 32px">&larr; Browse All Happy Hours</a></div>
<footer class="ft"><div class="sf" style="font-size:18px;font-weight:700;color:#2D6A8F;margin-bottom:6px">Michigan Happy Hour Guide</div>Built by <a href="https://solutionstud.io/">Solution Studio</a><br>Visit our sister site, <a href="https://traversecitywinetour.com">Traverse City Wine Tour</a><br>Listings are community-sourced · Hours and deals may change — <a href="/submit/" style="color:#E8614D">suggest an update</a><br><span style="color:#A8BFCC">&copy; 2026 MichiganHappyHour.com</span></footer>
</div>
<script src="/js/cta-track.js" defer></script>
</body>
</html>
`;
}

function buildPosts(db) {
  const p = (slug, suffix) => spotPara(db, slug, suffix);

  return [
    {
      slug: "tri-cities-happy-hour-guide",
      title: "Tri-Cities Happy Hour Guide (2026) | Saginaw, Bay City & Midland",
      h1: "The Ultimate Tri-Cities Happy Hour Guide (2026)",
      description:
        "Saginaw, Bay City & Midland happy hours — WhichCraft, Merl's, Prost, Big Ugly Fish, and more with real hours. Updated 2026.",
      breadcrumb: "Tri-Cities Guide",
      related: [
        { href: "/blog/flint-happy-hour-guide", title: "Flint Happy Hour Guide", desc: "Vehicle City breweries and downtown taverns." },
        { href: "/blog/detroit-happy-hour-guide", title: "Detroit Happy Hour Guide", desc: "Corktown cocktails, Midtown beer, and 400+ Detroit spots." },
        { href: "/blog/grand-rapids-happy-hour-guide", title: "Grand Rapids Happy Hour Guide", desc: "Beer City USA — Founders, HopCat, and more." },
      ],
      body: `
<p>Saginaw, Bay City, and Midland each have their own after-work rhythm &mdash; Midland taprooms pouring Michigan-only drafts, Saginaw taverns with long 3&ndash;7 windows, and Bay City wine bars along the riverfront. We&rsquo;ve mapped <strong>32 Tri-Cities spots</strong>; here are the ones with verified hours worth planning around.</p>
<h2>Midland</h2>
${p("whichcraft-taproom-midland")}
${p("frick-s-sports-bar-midland")}
<h2>Saginaw</h2>
${p("merl-s-tavern-saginaw")}
${p("harvey-s-grill-bar-saginaw")}
${p("big-ugly-fish-saginaw")}
${p("timbers-bar-grill-saginaw")}
${p("retro-rocks-saginaw")}
<h2>Bay City</h2>
${p("prost-wine-bar-charcuterie-bay-city")}
${p("old-city-hall-bay-city")}
${p("the-public-house-bay-city")}
<h2>How to Plan the Night</h2>
<p>Start at WhichCraft in Midland at 3 for Michigan drafts, swing through Merl&rsquo;s or Harvey&rsquo;s in Saginaw if you want wells still on special, then finish at Prost or Old City Hall in Bay City for wine and beer.</p>
<p>View all <a href="/regions/tri-cities">32 Tri-Cities happy hour spots</a> or <a href="/">browse the full Michigan guide</a>.</p>`,
    },
    {
      slug: "port-huron-happy-hour-guide",
      title: "Port Huron Happy Hour Guide (2026) | Blue Water & Thumb",
      h1: "Port Huron Happy Hour Guide (2026)",
      description:
        "Port Huron and Blue Water Area happy hours — breweries, waterfront bars, and Thumb taverns. Hours still being verified across the region.",
      breadcrumb: "Port Huron Guide",
      related: [
        { href: "/blog/tri-cities-happy-hour-guide", title: "Tri-Cities Happy Hour Guide", desc: "Saginaw, Bay City, and Midland after-work stops." },
        { href: "/blog/detroit-happy-hour-guide", title: "Detroit Happy Hour Guide", desc: "An hour south on I-69 — full city guide." },
        { href: "/regions/port-huron", title: "Port Huron Region Map", desc: "All 20 Blue Water & Thumb listings." },
      ],
      body: `
<p>Port Huron sits at the mouth of the St. Clair River with a growing brewery scene and classic waterfront bars &mdash; but honest caveat: many Thumb listings still need verified happy hour hours. We&rsquo;ve mapped <strong>20 Port Huron-area spots</strong>; call ahead or check the listing before you drive. Know a deal we&rsquo;re missing? <a href="/submit/">Submit an update</a>.</p>
<h2>Breweries &amp; Taprooms</h2>
${p("refined-fool-brewing-co-port-huron-thumb")}
${p("davis-by-refined-fool-brewing-company-port-huron-thumb")}
<h2>Waterfront &amp; Downtown Bars</h2>
${p("the-tin-fiddler-port-huron-thumb")}
${p("lizards-bar-grill-port-huron-thumb")}
${p("mccarthys-port-huron-thumb")}
${p("bottoms-up-port-huron-thumb")}
${p("piccadilly-bar-grill-port-huron-thumb")}
<h2>How to Use This Guide</h2>
<p>Refined Fool and Davis are the anchor brewery stops. For classic bar energy, Tin Fiddler and Piccadilly are local favorites &mdash; confirm specials before you go since several Port Huron listings are still community-sourced without fixed windows.</p>
<p>View all <a href="/regions/port-huron">20 Port Huron happy hour spots</a>, <a href="/submit/">suggest a deal</a>, or <a href="/">browse statewide</a>.</p>`,
    },
    {
      slug: "charlevoix-petoskey-happy-hour-guide",
      title: "Petoskey & Charlevoix Happy Hour Guide (2026)",
      h1: "Petoskey & Charlevoix Happy Hour Guide (2026)",
      description:
        "Petoskey and Charlevoix happy hours — Beards Brewery, Petoskey Brewing, City Park Grill, Tap 30, and more with real hours. Updated 2026.",
      breadcrumb: "Charlevoix & Petoskey",
      related: [
        { href: "/blog/traverse-city-happy-hour-guide", title: "Traverse City Happy Hour Guide", desc: "68 TC spots with patios, cocktails, and brewery deals." },
        { href: "/blog/waterfront-patio-happy-hours-michigan", title: "Waterfront & Patio Happy Hours", desc: "Statewide lakefront and patio specials." },
        { href: "/regions/charlevoix-petoskey", title: "Charlevoix & Petoskey Region", desc: "All 21 northern Michigan listings." },
      ],
      body: `
<p>Up north, happy hour means brewery patios overlooking Little Traverse Bay, Hemingway-era steakhouses, and pourhouses with 30 Michigan taps. We&rsquo;ve got <strong>21 Charlevoix &amp; Petoskey spots</strong> mapped &mdash; these six have verified hours and deals worth the drive.</p>
<h2>Petoskey</h2>
${p("beards-brewery-petoskey", "Monday $3 pints all day is the local move.")}
${p("petoskey-brewing-petoskey")}
${p("city-park-grill-petoskey")}
${p("palette-bistro-petoskey")}
<h2>Charlevoix</h2>
${p("tap-30-pourhouse-charlevoix")}
${p("castle-farms-winery-charlevoix")}
<h2>How to Plan the Night</h2>
<p>Start at Beards or Petoskey Brewing at 3, walk the Gaslight District for City Park Grill cocktails, then drive to Charlevoix for Tap 30 pints. Summer weekends fill patios first &mdash; arrive at open.</p>
<p>View all <a href="/regions/charlevoix-petoskey">21 Charlevoix &amp; Petoskey happy hour spots</a> or <a href="/">browse the full Michigan guide</a>.</p>`,
    },
    {
      slug: "waterfront-patio-happy-hours-michigan",
      title: "Best Waterfront & Patio Happy Hours in Michigan (2026)",
      h1: "Best Waterfront & Patio Happy Hours in Michigan (2026)",
      description:
        "Michigan waterfront and patio happy hours — Holland, Muskegon, Detroit, Traverse City, Leelanau, Marquette, and Petoskey spots with lake views and real deals.",
      breadcrumb: "Waterfront & Patio Happy Hours",
      related: [
        { href: "/collections/best-patios", title: "Best Patios Collection", desc: "All mapped patio happy hour spots statewide." },
        { href: "/blog/detroit-patio-happy-hours", title: "Detroit Patio Happy Hours", desc: "Campus Martius, Belt Alley tiki, and shipping containers." },
        { href: "/blog/traverse-city-happy-hour-guide", title: "Traverse City Happy Hour Guide", desc: "Front Street patios and brewery deals." },
      ],
      body: `
<p>Michigan&rsquo;s best happy hours happen on decks overlooking the Great Lakes, harbor marinas, and vineyard hillsides. These statewide picks combine real drink specials with outdoor seating worth planning your afternoon around.</p>
<h2>West Michigan</h2>
${p("boatwerks-waterfront-holland")}
${p("the-deck-muskegon")}
${p("pigeon-hill-brewing-muskegon")}
<h2>Detroit</h2>
${p("parc-detroit-detroit")}
${p("the-skip-detroit")}
<h2>Traverse City &amp; Leelanau</h2>
${p("the-little-fleet-traverse-city")}
${p("hop-lot-brewing-suttons-bay")}
${p("the-cove-leland")}
${p("chateau-chantal-old-mission")}
<h2>Up North &amp; UP</h2>
${p("beards-brewery-petoskey")}
${p("blackrocks-brewery-marquette")}
${p("iron-bay-restaurant-drinkery-marquette")}
${p("portside-inn-marquette")}
<h2>How to Use This List</h2>
<p>For the full patio map, browse our <a href="/collections/best-patios">best patios collection</a>. Detroit readers should also see the <a href="/blog/detroit-patio-happy-hours">Detroit patio happy hour guide</a> for Campus Martius and Belt Alley routes.</p>
<p>Or jump into a city guide: <a href="/blog/holland-happy-hour-guide">Holland</a>, <a href="/blog/muskegon-happy-hour-guide">Muskegon</a>, <a href="/blog/marquette-happy-hour-guide">Marquette</a>.</p>`,
    },
    {
      slug: "cheap-happy-hour-deals-michigan",
      title: "Best Cheap Happy Hours in Michigan (2026) | $5 & Under Deals",
      h1: "Best Cheap Happy Hours in Michigan (2026)",
      description:
        "Michigan's best cheap happy hours — $5 wells, $3 wines, $2 PBR, $2 oysters, and brewery pint deals statewide. Deals change; always confirm before you go.",
      breadcrumb: "Cheap Happy Hour Deals",
      related: [
        { href: "/blog/sunday-happy-hour-michigan", title: "Best Sunday Happy Hours", desc: "Weekend-friendly deals when Mon–Fri windows don't work." },
        { href: "/blog/college-town-happy-hours-michigan", title: "College Town Happy Hours", desc: "Ann Arbor, East Lansing, and Kalamazoo value picks." },
        { href: "/blog/late-night-happy-hour-michigan", title: "Late-Night Happy Hours", desc: "Spots that keep specials going after dinner." },
      ],
      body: `
<p>Happy hour doesn&rsquo;t have to mean $15 cocktails. These Michigan spots deliver wells under $5, $2 beers, and food deals that actually move the needle &mdash; from Detroit dives to UP breweries. <em>Deals change; confirm hours before you go.</em></p>
<h2>Detroit &amp; Lansing</h2>
${p("anchor-bar-detroit")}
${p("bakersfield-det-detroit", "$2 tacos pair with the $5 margs.")}
${p("dragonfly-detroit")}
${p("zoobie-s-old-town-tavern-lansing")}
<h2>Grand Rapids &amp; Kalamazoo</h2>
${p("brick-and-porter-grand-rapids")}
${p("founders-brewing-co-grand-rapids")}
${p("louie-s-trophy-house-kalamazoo")}
${p("carolina-lowcountry-kitchen-grand-rapids", "Fresh oysters for $2 at happy hour.")}
<h2>Up North &amp; Tri-Cities</h2>
${p("merl-s-tavern-saginaw")}
${p("beards-brewery-petoskey", "Monday $3 pints all day.")}
${p("bubba-s-traverse-city", "Late-night $2 wells from 9 PM to close.")}
<h2>How to Stretch Your Dollar</h2>
<p>Anchor Bar and Brick and Porter are the reliable $3&ndash;$5 well stops. Founders and Beards reward brewery loyalists with dollar-off pints. For late value, Bubba&rsquo;s second-act specials on Front Street are hard to beat.</p>
<p><a href="/">Browse all Michigan happy hours</a> or filter by region on the <a href="/map/">interactive map</a>.</p>`,
    },
    {
      slug: "sunday-happy-hour-michigan",
      title: "Best Sunday Happy Hours in Michigan (2026)",
      h1: "Best Sunday Happy Hours in Michigan (2026)",
      description:
        "Michigan happy hours that run on Sunday — Traverse City patios, Ann Arbor beer bars, Grand Rapids oysters, and Mackinac Island stops. Most Michigan HH are Mon–Fri only.",
      breadcrumb: "Sunday Happy Hours",
      related: [
        { href: "/blog/cheap-happy-hour-deals-michigan", title: "Cheap Happy Hour Deals", desc: "$5 and under specials statewide." },
        { href: "/blog/ann-arbor-happy-hour-guide", title: "Ann Arbor Happy Hour Guide", desc: "Ashley's seven-day window and campus deals." },
        { href: "/blog/traverse-city-happy-hour-guide", title: "Traverse City Happy Hour Guide", desc: "Front Street patios that run every day." },
      ],
      body: `
<p>Most Michigan happy hours run Monday through Friday only &mdash; which makes Sunday planners feel left out. These spots list Sunday in their happy hour days with real deals, from Traverse City food-truck courts to Ann Arbor beer temples and Mackinac Island institutions.</p>
<h2>Traverse City (every-day energy)</h2>
${p("the-little-fleet-traverse-city")}
${p("mama-lu-s-taco-shop-traverse-city")}
${p("firefly-traverse-city")}
${p("rare-bird-brewpub-traverse-city")}
<h2>Ann Arbor &amp; Grand Rapids</h2>
${p("ashley-s-ann-arbor")}
${p("aventura-ann-arbor")}
${p("mani-osteria-ann-arbor")}
${p("carolina-lowcountry-kitchen-grand-rapids")}
${p("the-apartment-lounge-grand-rapids", "Sunday Bloody Mary bar is the draw.")}
<h2>Up North</h2>
${p("tap-30-pourhouse-charlevoix")}
${p("horn-s-gaslight-bar-mackinac-island")}
${p("gate-house-at-mission-point-mackinac-island")}
<h2>Sunday Planning Tips</h2>
<p>Ashley&rsquo;s and The Little Fleet are the safest Sunday bets when you don&rsquo;t want to call ahead. For island trips, Horn&rsquo;s Gaslight and Gate House both run daily windows &mdash; factor in ferry time so you&rsquo;re seated before specials end.</p>
<p>Most Michigan bars still skip Sunday entirely. When in doubt, check our <a href="/map/">map</a> or city guides: <a href="/blog/ann-arbor-happy-hour-guide">Ann Arbor</a>, <a href="/blog/grand-rapids-happy-hour-guide">Grand Rapids</a>, <a href="/blog/traverse-city-happy-hour-guide">Traverse City</a>.</p>`,
    },
    {
      slug: "college-town-happy-hours-michigan",
      title: "Best College Town Happy Hours in Michigan (2026)",
      h1: "Best College Town Happy Hours in Michigan (2026)",
      description:
        "Ann Arbor, East Lansing, and Kalamazoo happy hours — Ashley's, Brown Jug, HopCat, Bell's, and campus-bar deals with real hours. Plus Mount Pleasant picks.",
      breadcrumb: "College Town Happy Hours",
      related: [
        { href: "/blog/ann-arbor-happy-hour-guide", title: "Ann Arbor Happy Hour Guide", desc: "69 campus and downtown spots with real deals." },
        { href: "/blog/lansing-happy-hour-guide", title: "Lansing Happy Hour Guide", desc: "East Lansing and downtown Lansing after-work stops." },
        { href: "/blog/kalamazoo-happy-hour-guide", title: "Kalamazoo Happy Hour Guide", desc: "Bell's, HopCat, and Vine Street value picks." },
      ],
      body: `
<p>College towns do happy hour differently &mdash; early campus windows, brewery rooms steps from lecture halls, and cocktail bars that fill up the second classes end. Here are the best deals in Michigan&rsquo;s biggest university cities, plus a nod to Mount Pleasant.</p>
<h2>Ann Arbor</h2>
${p("ashley-s-ann-arbor")}
${p("the-brown-jug-ann-arbor")}
${p("hopcat-ann-arbor-ann-arbor")}
${p("the-circ-bar-ann-arbor", "Rare 6&ndash;9 PM window — one of Michigan&rsquo;s latest.")}
${p("the-last-word-ann-arbor")}
${p("mani-osteria-ann-arbor")}
<p>Read the full <a href="/blog/ann-arbor-happy-hour-guide">Ann Arbor happy hour guide</a> for 69 mapped spots.</p>
<h2>East Lansing</h2>
${p("hopcat-east-lansing-east-lansing")}
${p("fieldhouse-east-lansing")}
${p("beggar-s-banquet-east-lansing")}
${p("sidebar-east-lansing-east-lansing")}
<p>See the <a href="/blog/lansing-happy-hour-guide">Lansing &amp; East Lansing guide</a> for the full circuit.</p>
<h2>Kalamazoo</h2>
${p("bell-s-eccentric-cafe-kalamazoo")}
${p("hopcat-kalamazoo-kalamazoo")}
${p("louie-s-trophy-house-kalamazoo")}
<p>More at the <a href="/blog/kalamazoo-happy-hour-guide">Kalamazoo happy hour guide</a>.</p>
<h2>Mount Pleasant (CMU)</h2>
<p>Central Michigan University&rsquo;s bar scene is smaller but active &mdash; browse <a href="/regions/mount-pleasant">8 Mount Pleasant happy hour spots</a> for campus-adjacent dives and sports bars.</p>
<p><a href="/">Browse all Michigan happy hours</a> or filter by region on the map.</p>`,
    },
    {
      slug: "upper-peninsula-happy-hour-road-trip",
      title: "Upper Peninsula Happy Hour Road Trip (2026)",
      h1: "Upper Peninsula Happy Hour Road Trip (2026)",
      description:
        "UP happy hour road trip — Marquette breweries and waterfront bars, then Eastern UP stops in Sault Ste. Marie and Escanaba. Verified Marquette hours plus confirm-before-you-go picks east.",
      breadcrumb: "UP Happy Hour Road Trip",
      related: [
        { href: "/blog/marquette-happy-hour-guide", title: "Marquette Happy Hour Guide", desc: "Ore Dock, Blackrocks, Iron Bay, and 23 mapped spots." },
        { href: "/blog/dog-friendly-happy-hours-michigan", title: "Dog-Friendly Happy Hours", desc: "Patio spots where your pup is welcome." },
        { href: "/blog/waterfront-patio-happy-hours-michigan", title: "Waterfront & Patio Happy Hours", desc: "Lake Superior and harbor decks statewide." },
      ],
      body: `
<p>A UP happy hour road trip runs on brewery patios, whitefish tacos, and harbor views &mdash; with long drives between stops. Start in Marquette where we have the most verified hours, then push east toward Sault Ste. Marie and the Lake Huron shore.</p>
<h2>Marquette (verified hours)</h2>
${p("the-vierling-marquette")}
${p("blackrocks-brewery-marquette")}
${p("ore-dock-brewing-marquette")}
${p("iron-bay-restaurant-drinkery-marquette")}
${p("portside-inn-marquette")}
${p("drifa-brewing-co-op-marquette")}
${p("stucko-s-pub-grill-marquette")}
${p("the-honorable-marquette")}
${p("zephyr-wine-bar-marquette")}
${p("lagniappe-cajun-creole-eatery-marquette")}
<p>Full local playbook: <a href="/blog/marquette-happy-hour-guide">Marquette happy hour guide</a>. Traveling with a dog? See <a href="/blog/dog-friendly-happy-hours-michigan">dog-friendly happy hours</a>.</p>
<h2>Eastern UP Stops</h2>
${p("harp-bar-and-grill-sault-ste-marie", "Confirm specials before you go — hours vary seasonally.")}
<p>${p("upper-hand-brewery-escanaba", "Call ahead for current happy hour windows.")}</p>
${p("east-channel-brewing-eastern-up", "Sault-area taproom — confirm today&rsquo;s specials.")}
${p("bygeorge-brewing-eastern-up", "Eastern UP brewery stop — verify hours before driving.")}
<h2>Plan the Route</h2>
<p>Marquette alone could fill a weekend: start at Ore Dock or Blackrocks at 3, walk Iron Bay for tacos, finish at Zephyr or Lagniappe. Heading east, browse <a href="/regions/up-west">Western UP</a> (43 spots) and <a href="/regions/up-east">Eastern UP</a> (37 spots) for the full map.</p>
<p><a href="/blog/marquette-happy-hour-guide">Marquette guide</a> &middot; <a href="/regions/marquette">Marquette region</a> &middot; <a href="/">all Michigan happy hours</a></p>`,
    },
  ];
}

function main() {
  const db = buildVenueDb();
  const posts = buildPosts(db);
  const written = [];

  for (const post of posts) {
    const filename = `${post.slug}.html`;
    const outPath = path.join(blogDir, filename);
    fs.writeFileSync(outPath, renderPost(post, post.body.trim()));
    written.push(outPath);
  }

  console.log("Wrote blog posts:");
  for (const f of written) {
    console.log(`  ${f}`);
  }
  console.log("\nBLOG_SLUGS for sitemap:");
  console.log(JSON.stringify(BLOG_SLUGS, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
