#!/usr/bin/env node
/**
 * Discover Michigan bars / pubs / breweries / wine bars / distilleries via
 * OpenStreetMap Overpass and upsert into D1 without wiping curated rows.
 *
 * Usage:
 *   node scripts/import-osm-venues.mjs              # fetch + write SQL/JSON
 *   node scripts/import-osm-venues.mjs --apply-remote
 *   node scripts/import-osm-venues.mjs --apply-local
 *   node scripts/import-osm-venues.mjs --dry-run     # fetch only, no SQL write
 *   node scripts/import-osm-venues.mjs --only=port-huron,jackson  # limit hubs by region id
 *   node scripts/import-osm-venues.mjs --pass=2                   # only hubs tagged pass:2
 *
 * Respects OSM usage policy: identifiable UA, paced requests.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT_DIR = path.join(root, "scripts", "generated");
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const UA = "MichiganHappyHour/1.0 (+https://michiganhappyhour.com; bulk venue discovery)";

const REGION_META = {
  "traverse-city": { name: "Traverse City", color: "#E8614D" },
  leelanau: { name: "Leelanau Peninsula", color: "#0D9488" },
  "old-mission": { name: "Old Mission Peninsula", color: "#7C3AED" },
  "elk-rapids": { name: "Elk Rapids & Torch Lake", color: "#2563EB" },
  "frankfort-benzie": { name: "Frankfort & Benzie", color: "#0891B2" },
  "charlevoix-petoskey": { name: "Charlevoix & Petoskey", color: "#DB2777" },
  "bellaire-mancelona": { name: "Bellaire & Mancelona", color: "#65A30D" },
  mackinaw: { name: "Mackinaw & Mackinac", color: "#EA580C" },
  "grand-rapids": { name: "Grand Rapids", color: "#4F46E5" },
  "ann-arbor": { name: "Ann Arbor", color: "#CA8A04" },
  detroit: { name: "Detroit", color: "#DC2626" },
  kalamazoo: { name: "Kalamazoo", color: "#9333EA" },
  lansing: { name: "Lansing", color: "#16A34A" },
  holland: { name: "Holland", color: "#0284C7" },
  muskegon: { name: "Muskegon", color: "#0F766E" },
  marquette: { name: "Marquette", color: "#B45309" },
  "tri-cities": { name: "Saginaw/Bay City", color: "#BE123C" },
  flint: { name: "Flint", color: "#4338CA" },
  "port-huron": { name: "Port Huron & Thumb", color: "#0E7490" },
  jackson: { name: "Jackson", color: "#A16207" },
  "battle-creek": { name: "Battle Creek", color: "#B91C1C" },
  "southwest-mi": { name: "SW Michigan", color: "#047857" },
  "monroe-adrian": { name: "Monroe & Adrian", color: "#7C2D12" },
  "mount-pleasant": { name: "Mount Pleasant", color: "#1D4ED8" },
  cadillac: { name: "Cadillac", color: "#365314" },
  "west-shore": { name: "Ludington & Manistee", color: "#0369A1" },
  "northeast-mi": { name: "Northeast Michigan", color: "#6D28D9" },
  "up-west": { name: "Western UP", color: "#92400E" },
  "up-east": { name: "Eastern UP", color: "#1E3A5F" },
  livingston: { name: "Brighton & Howell", color: "#C2410C" },
  "south-central": { name: "South Central Michigan", color: "#9F1239" },
  "west-central": { name: "West Central Michigan", color: "#115E59" }
};

/** Search hubs: region id + lat/lng + radius meters. Overlaps OK; we dedupe by OSM id. */
const HUBS = [
  { region: "traverse-city", lat: 44.7631, lng: -85.6206, r: 14000 },
  { region: "leelanau", lat: 45.02, lng: -85.75, r: 28000 },
  { region: "old-mission", lat: 44.9, lng: -85.52, r: 14000 },
  { region: "elk-rapids", lat: 44.9, lng: -85.38, r: 18000 },
  { region: "frankfort-benzie", lat: 44.63, lng: -86.15, r: 22000 },
  { region: "charlevoix-petoskey", lat: 45.37, lng: -85.05, r: 32000 },
  { region: "bellaire-mancelona", lat: 44.98, lng: -85.2, r: 20000 },
  { region: "mackinaw", lat: 45.78, lng: -84.73, r: 22000 },
  { region: "grand-rapids", lat: 42.9634, lng: -85.6681, r: 20000 },
  { region: "ann-arbor", lat: 42.2808, lng: -83.743, r: 14000 },
  { region: "detroit", lat: 42.3314, lng: -83.0458, r: 14000 },
  { region: "detroit", lat: 42.38, lng: -83.08, r: 10000 },
  { region: "detroit", lat: 42.45, lng: -83.12, r: 12000 },
  { region: "detroit", lat: 42.48, lng: -83.15, r: 12000 },
  { region: "detroit", lat: 42.33, lng: -83.2, r: 11000 },
  { region: "detroit", lat: 42.28, lng: -83.25, r: 10000 },
  { region: "kalamazoo", lat: 42.2917, lng: -85.5872, r: 14000 },
  { region: "lansing", lat: 42.7325, lng: -84.5555, r: 16000 },
  { region: "holland", lat: 42.7875, lng: -86.109, r: 14000 },
  { region: "muskegon", lat: 43.2342, lng: -86.2484, r: 14000 },
  { region: "marquette", lat: 46.5436, lng: -87.3954, r: 16000 },
  { region: "tri-cities", lat: 43.4195, lng: -83.9508, r: 16000 },
  { region: "tri-cities", lat: 43.5945, lng: -83.8889, r: 14000 },
  { region: "tri-cities", lat: 43.6156, lng: -84.2472, r: 14000 },
  { region: "flint", lat: 43.0125, lng: -83.6875, r: 14000 },
  // Coverage gap markets
  { region: "port-huron", lat: 42.9709, lng: -82.4249, r: 18000 },
  { region: "port-huron", lat: 43.7464, lng: -82.9994, r: 22000 }, // Bad Axe / Thumb
  { region: "jackson", lat: 42.2459, lng: -84.4013, r: 15000 },
  { region: "battle-creek", lat: 42.3212, lng: -85.1797, r: 15000 },
  { region: "southwest-mi", lat: 42.1167, lng: -86.4542, r: 16000 }, // Benton Harbor / St. Joe
  { region: "southwest-mi", lat: 41.8298, lng: -86.2542, r: 14000 }, // Niles
  { region: "monroe-adrian", lat: 41.9164, lng: -83.3977, r: 14000 },
  { region: "monroe-adrian", lat: 41.8975, lng: -84.0372, r: 14000 },
  { region: "mount-pleasant", lat: 43.5978, lng: -84.7675, r: 14000 },
  { region: "cadillac", lat: 44.2519, lng: -85.4012, r: 16000 },
  { region: "west-shore", lat: 43.9553, lng: -86.4526, r: 14000 }, // Ludington
  { region: "west-shore", lat: 44.2475, lng: -86.3242, r: 14000 }, // Manistee
  { region: "northeast-mi", lat: 45.0617, lng: -83.4327, r: 16000 }, // Alpena
  { region: "northeast-mi", lat: 45.0275, lng: -84.6747, r: 16000 }, // Gaylord
  { region: "northeast-mi", lat: 44.6614, lng: -84.7147, r: 14000 }, // Grayling
  { region: "up-west", lat: 47.1211, lng: -88.5694, r: 20000 }, // Houghton / Hancock
  { region: "up-west", lat: 45.8202, lng: -88.0659, r: 16000 }, // Iron Mountain
  { region: "up-east", lat: 46.4953, lng: -84.3453, r: 16000 }, // Sault Ste. Marie
  { region: "up-east", lat: 45.7453, lng: -87.0646, r: 16000 }, // Escanaba
  // Pass 2 — remaining empty corridors
  { pass: 2, region: "livingston", lat: 42.5295, lng: -83.7802, r: 14000 }, // Brighton
  { pass: 2, region: "livingston", lat: 42.6073, lng: -83.9294, r: 14000 }, // Howell
  { pass: 2, region: "south-central", lat: 41.9403, lng: -85.0005, r: 14000 }, // Coldwater
  { pass: 2, region: "south-central", lat: 41.92, lng: -84.6305, r: 14000 }, // Hillsdale
  { pass: 2, region: "south-central", lat: 41.7992, lng: -85.4191, r: 14000 }, // Sturgis
  { pass: 2, region: "south-central", lat: 41.9439, lng: -85.6322, r: 14000 }, // Three Rivers
  { pass: 2, region: "south-central", lat: 42.2723, lng: -84.9633, r: 12000 }, // Marshall
  { pass: 2, region: "south-central", lat: 42.2709, lng: -84.753, r: 12000 }, // Albion
  { pass: 2, region: "west-central", lat: 43.6981, lng: -85.4837, r: 16000 }, // Big Rapids
  { pass: 2, region: "west-central", lat: 43.8195, lng: -84.7686, r: 14000 }, // Clare
  { pass: 2, region: "west-central", lat: 43.4675, lng: -85.942, r: 14000 }, // Fremont
  { pass: 2, region: "west-central", lat: 43.4197, lng: -85.8, r: 12000 }, // Newaygo
  { pass: 2, region: "muskegon", lat: 43.0631, lng: -86.2284, r: 14000 }, // Grand Haven
  { pass: 2, region: "muskegon", lat: 43.41, lng: -86.3487, r: 12000 }, // Whitehall
  { pass: 2, region: "holland", lat: 42.655, lng: -86.2019, r: 14000 }, // Saugatuck / Douglas
  { pass: 2, region: "holland", lat: 42.4031, lng: -86.2736, r: 14000 }, // South Haven
  { pass: 2, region: "southwest-mi", lat: 41.7939, lng: -86.7439, r: 14000 }, // New Buffalo
  { pass: 2, region: "detroit", lat: 42.4806, lng: -83.4755, r: 12000 }, // Novi
  { pass: 2, region: "detroit", lat: 42.3714, lng: -83.4702, r: 11000 }, // Plymouth
  { pass: 2, region: "detroit", lat: 42.6584, lng: -83.1499, r: 12000 }, // Rochester Hills
  { pass: 2, region: "detroit", lat: 42.6056, lng: -83.1499, r: 11000 }, // Troy
  { pass: 2, region: "ann-arbor", lat: 42.3181, lng: -84.0205, r: 12000 }, // Chelsea
  { pass: 2, region: "ann-arbor", lat: 42.1667, lng: -83.7816, r: 11000 }, // Saline
  { pass: 2, region: "lansing", lat: 42.9978, lng: -84.1766, r: 14000 }, // Owosso
  { pass: 2, region: "lansing", lat: 42.5636, lng: -84.8358, r: 12000 }, // Charlotte
  { pass: 2, region: "grand-rapids", lat: 42.9873, lng: -85.0711, r: 14000 }, // Ionia
  { pass: 2, region: "grand-rapids", lat: 42.6459, lng: -85.2908, r: 14000 }, // Hastings
  { pass: 2, region: "flint", lat: 43.0514, lng: -83.3188, r: 14000 }, // Lapeer
  { pass: 2, region: "mount-pleasant", lat: 43.3789, lng: -84.6597, r: 14000 }, // Alma
  { pass: 2, region: "cadillac", lat: 44.0192, lng: -84.7995, r: 14000 }, // Harrison
  { pass: 2, region: "mackinaw", lat: 45.647, lng: -84.4745, r: 16000 }, // Cheboygan
  { pass: 2, region: "northeast-mi", lat: 44.4203, lng: -83.3308, r: 14000 }, // Oscoda
  { pass: 2, region: "northeast-mi", lat: 44.2695, lng: -83.5147, r: 14000 }, // Tawas
  { pass: 2, region: "northeast-mi", lat: 45.4214, lng: -83.8183, r: 14000 }, // Rogers City
  { pass: 2, region: "marquette", lat: 46.4885, lng: -87.6676, r: 14000 }, // Ishpeming
  { pass: 2, region: "up-east", lat: 46.4111, lng: -86.6479, r: 16000 }, // Munising
  { pass: 2, region: "up-east", lat: 45.9577, lng: -86.2462, r: 14000 }, // Manistique
  { pass: 2, region: "up-east", lat: 46.355, lng: -85.5096, r: 14000 }, // Newberry
  { pass: 2, region: "up-west", lat: 46.4547, lng: -90.1712, r: 16000 }, // Ironwood
  { pass: 2, region: "up-west", lat: 46.0927, lng: -88.6423, r: 14000 }, // Iron River
  { pass: 2, region: "monroe-adrian", lat: 42.0062, lng: -83.945, r: 12000 }, // Tecumseh
  { pass: 2, region: "kalamazoo", lat: 42.2012, lng: -85.58, r: 12000 } // Portage
];

const ALL_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

function sqlStr(v) {
  if (v == null) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function slugify(name, town) {
  return `${name}-${town}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function categoryFromTags(tags) {
  const amenity = tags.amenity || "";
  const craft = tags.craft || "";
  const industrial = tags.industrial || "";
  if (craft === "brewery" || industrial === "brewery" || amenity === "brewery") return "Brewery";
  if (craft === "distillery" || amenity === "distillery") return "Distillery";
  if (amenity === "wine_bar" || tags.tourism === "wine_cellar" || tags.shop === "wine") return "Wine Bar";
  if (amenity === "pub") return "Taproom";
  if (amenity === "bar" || amenity === "biergarten" || amenity === "nightclub") return "Cocktail Bar";
  if (amenity === "restaurant") return "Restaurant";
  return "Cocktail Bar";
}

function buildAddress(tags) {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:unit"] ? `#${tags["addr:unit"]}` : ""
  ]
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.join(" ") || null;
}

function townFromTags(tags, fallbackRegion) {
  return (
    tags["addr:city"] ||
    tags["addr:town"] ||
    tags["addr:suburb"] ||
    tags["addr:hamlet"] ||
    REGION_META[fallbackRegion]?.name ||
    "Michigan"
  );
}

function coordsOf(el) {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lng: el.lon };
  }
  if (el.center && typeof el.center.lat === "number") {
    return { lat: el.center.lat, lng: el.center.lon };
  }
  return null;
}

function buildQuery(hub) {
  const { lat, lng, r } = hub;
  return `
[out:json][timeout:75];
(
  node["amenity"="bar"](around:${r},${lat},${lng});
  way["amenity"="bar"](around:${r},${lat},${lng});
  node["amenity"="pub"](around:${r},${lat},${lng});
  way["amenity"="pub"](around:${r},${lat},${lng});
  node["amenity"="biergarten"](around:${r},${lat},${lng});
  way["amenity"="biergarten"](around:${r},${lat},${lng});
  node["amenity"="nightclub"](around:${r},${lat},${lng});
  way["amenity"="nightclub"](around:${r},${lat},${lng});
  node["amenity"="wine_bar"](around:${r},${lat},${lng});
  way["amenity"="wine_bar"](around:${r},${lat},${lng});
  node["craft"="brewery"](around:${r},${lat},${lng});
  way["craft"="brewery"](around:${r},${lat},${lng});
  node["industrial"="brewery"](around:${r},${lat},${lng});
  way["industrial"="brewery"](around:${r},${lat},${lng});
  node["craft"="distillery"](around:${r},${lat},${lng});
  way["craft"="distillery"](around:${r},${lat},${lng});
  node["amenity"="restaurant"]["happy_hour"](around:${r},${lat},${lng});
  way["amenity"="restaurant"]["happy_hour"](around:${r},${lat},${lng});
);
out center tags;
`.trim();
}

async function overpass(hub, attempt = 1) {
  const body = buildQuery(hub);
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA
    },
    body: "data=" + encodeURIComponent(body)
  });
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 5) throw new Error(`Overpass ${res.status} after retries`);
    const wait = 4000 * attempt;
    console.warn(`  Overpass ${res.status} — retry in ${wait}ms`);
    await sleep(wait);
    return overpass(hub, attempt + 1);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Overpass ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function loadExistingFromApi() {
  // Prefer live API so we don't need D1 for dry planning; optional.
  return null;
}

function fetchExistingFromD1(remote) {
  const flag = remote ? "--remote" : "--local";
  const res = spawnSync(
    "npx",
    [
      "wrangler",
      "d1",
      "execute",
      "michiganhappyhour",
      flag,
      "--json",
      "--command",
      "SELECT id, name, town, lat, lng, external_id, source FROM venues"
    ],
    { cwd: root, encoding: "utf8", shell: process.platform === "win32" }
  );
  if (res.status !== 0) {
    console.warn("Could not load existing venues from D1:", res.stderr || res.stdout);
    return [];
  }
  try {
    const parsed = JSON.parse(res.stdout);
    return parsed[0]?.results || [];
  } catch (e) {
    console.warn("Failed to parse D1 existing venues:", e.message);
    return [];
  }
}

function isNearDuplicate(candidate, existing) {
  const n = normName(candidate.name);
  for (const ex of existing) {
    if (ex.external_id && ex.external_id === candidate.external_id) return true;
    const en = normName(ex.name);
    if (!en || !n) continue;
    const nameClose = en === n || en.includes(n) || n.includes(en);
    if (!nameClose) continue;
    // Same-ish name: require nearby coords when both have them
    if (
      candidate.lat != null &&
      candidate.lng != null &&
      ex.lat != null &&
      ex.lng != null
    ) {
      const dLat = Math.abs(candidate.lat - Number(ex.lat));
      const dLng = Math.abs(candidate.lng - Number(ex.lng));
      if (dLat < 0.01 && dLng < 0.01) return true; // ~0.7mi
    } else if (normName(ex.town) === normName(candidate.town)) {
      return true;
    }
  }
  return false;
}

function elementToVenue(el, regionHint) {
  const tags = el.tags || {};
  const name = (tags.name || "").trim();
  if (!name) return null;
  // Skip chains / non-venues that sometimes get tagged
  if (/^(atm|parking|restroom)/i.test(name)) return null;

  const coords = coordsOf(el);
  if (!coords) return null;

  const region = regionHint;
  const meta = REGION_META[region] || { name: region, color: "#E8614D" };
  const town = townFromTags(tags, region);
  const external_id = `osm:${el.type}/${el.id}`;
  const phone = tags.phone || tags["contact:phone"] || null;
  const website = tags.website || tags["contact:website"] || tags.url || null;
  const opening_hours = tags.opening_hours || tags["opening_hours:kitchen"] || null;
  const hasHhTag = Boolean(tags.happy_hour || tags.happy_hours);
  const dogFriendly =
    tags.dog === "yes" ||
    tags.dogs === "yes" ||
    tags["dog:friendly"] === "yes" ||
    tags["dogs:welcome"] === "yes"
      ? 1
      : 0;

  return {
    name,
    category: categoryFromTags(tags),
    region,
    region_name: meta.name,
    region_color: meta.color,
    town,
    address: buildAddress(tags),
    phone,
    website,
    opening_hours,
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: hasHhTag
      ? ["Ask about today's happy hour specials"]
      : ["Ask about today's drink & food specials"],
    vibe: "A solid spot for a midweek pour — check what's on special when you arrive",
    lat: coords.lat,
    lng: coords.lng,
    featured: 0,
    dog_friendly: dogFriendly,
    collections: [],
    spot_path: `../spots/${slugify(name, town)}.html`,
    status: "published",
    source: "osm",
    external_id,
    admin_notes: `Imported from OSM ${el.type}/${el.id}`
  };
}

function venueInsertSql(v) {
  // Upsert on external_id. Never touch curated rows (they have NULL external_id /
  // source curated). Re-imports refresh OSM fields only.
  return (
    "INSERT INTO venues (name,category,region,region_name,region_color,town,address,phone,website,opening_hours,hh_start,hh_end,hh_days,deals,vibe,lat,lng,featured,dog_friendly,collections,spot_path,status,source,external_id,admin_notes) VALUES (" +
    [
      sqlStr(v.name),
      sqlStr(v.category),
      sqlStr(v.region),
      sqlStr(v.region_name),
      sqlStr(v.region_color),
      sqlStr(v.town),
      sqlStr(v.address),
      sqlStr(v.phone),
      sqlStr(v.website),
      sqlStr(v.opening_hours),
      sqlStr(v.hh_start),
      sqlStr(v.hh_end),
      sqlStr(JSON.stringify(v.hh_days)),
      sqlStr(JSON.stringify(v.deals)),
      sqlStr(v.vibe),
      v.lat == null ? "NULL" : Number(v.lat),
      v.lng == null ? "NULL" : Number(v.lng),
      0,
      v.dog_friendly ? 1 : 0,
      sqlStr("[]"),
      sqlStr(v.spot_path),
      sqlStr("published"),
      sqlStr("osm"),
      sqlStr(v.external_id),
      sqlStr(v.admin_notes)
    ].join(",") +
    ") ON CONFLICT(external_id) DO UPDATE SET " +
    [
      "name=excluded.name",
      "category=excluded.category",
      "region=excluded.region",
      "region_name=excluded.region_name",
      "region_color=excluded.region_color",
      "town=excluded.town",
      "address=COALESCE(excluded.address, venues.address)",
      "phone=COALESCE(excluded.phone, venues.phone)",
      "website=COALESCE(excluded.website, venues.website)",
      "opening_hours=COALESCE(excluded.opening_hours, venues.opening_hours)",
      "lat=excluded.lat",
      "lng=excluded.lng",
      "spot_path=excluded.spot_path",
      "dog_friendly=CASE WHEN excluded.dog_friendly=1 THEN 1 ELSE venues.dog_friendly END",
      "updated_at=datetime('now')",
      // Preserve any admin-curated deals/hours if already enriched
      "deals=CASE WHEN venues.source='osm' AND (venues.deals LIKE '%Ask about today%' OR venues.deals LIKE '%not verified%') THEN excluded.deals ELSE venues.deals END",
      "hh_start=CASE WHEN venues.source='osm' AND venues.hh_start IS NULL THEN excluded.hh_start ELSE venues.hh_start END",
      "hh_end=CASE WHEN venues.source='osm' AND venues.hh_end IS NULL THEN excluded.hh_end ELSE venues.hh_end END"
    ].join(", ") +
    ";"
  );
}

function parseOnlyRegions() {
  const arg = process.argv.find((a) => a.startsWith("--only="));
  if (!arg) return null;
  const set = new Set(
    arg
      .slice("--only=".length)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  return set.size ? set : null;
}

function parsePass() {
  const arg = process.argv.find((a) => a.startsWith("--pass="));
  if (!arg) return null;
  const n = Number(arg.slice("--pass=".length));
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const applyRemote = process.argv.includes("--apply-remote");
  const applyLocal = process.argv.includes("--apply-local");
  const dryRun = process.argv.includes("--dry-run");
  const only = parseOnlyRegions();
  const pass = parsePass();

  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("Loading existing D1 venues for dedupe…");
  const existing = fetchExistingFromD1(true);
  console.log(`  ${existing.length} existing rows`);

  let hubs = HUBS;
  if (pass != null) hubs = hubs.filter((h) => h.pass === pass);
  if (only) hubs = hubs.filter((h) => only.has(h.region));
  if (!hubs.length) {
    console.error("No hubs matched filters.");
    process.exit(1);
  }
  if (pass != null) console.log(`Filtering to pass=${pass} (${hubs.length} hubs)`);
  if (only) console.log(`Filtering hubs to: ${[...only].join(", ")} (${hubs.length} hubs)`);

  const byOsm = new Map();
  for (let i = 0; i < hubs.length; i++) {
    const hub = hubs[i];
    process.stdout.write(
      `[${i + 1}/${hubs.length}] ${hub.region} @ ${hub.lat},${hub.lng} r=${hub.r}… `
    );
    try {
      const data = await overpass(hub);
      const els = data.elements || [];
      let added = 0;
      for (const el of els) {
        const v = elementToVenue(el, hub.region);
        if (!v) continue;
        if (!byOsm.has(v.external_id)) {
          byOsm.set(v.external_id, v);
          added++;
        }
      }
      console.log(`${els.length} raw, ${added} new unique`);
    } catch (err) {
      console.log("FAILED:", err.message);
    }
    await sleep(2500);
  }

  const discovered = [...byOsm.values()];
  const fresh = [];
  const skippedDup = [];
  for (const v of discovered) {
    if (isNearDuplicate(v, existing) || isNearDuplicate(v, fresh)) {
      skippedDup.push(v);
      continue;
    }
    fresh.push(v);
  }

  console.log(
    `\nDiscovered ${discovered.length} OSM venues; ${fresh.length} new after dedupe; ${skippedDup.length} skipped as near-dupes of existing.`
  );

  const jsonPath = path.join(OUT_DIR, "osm-venues.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ fresh, skippedDup, discoveredCount: discovered.length }, null, 2));
  console.log(`Wrote ${jsonPath}`);

  if (dryRun) {
    console.log("Dry run — not writing SQL.");
    return;
  }

  const statements = [
    "-- Auto-generated OSM venue upserts. Safe to re-run.",
    ...fresh.map(venueInsertSql)
  ];
  const sqlPath = path.join(OUT_DIR, "osm-venues.sql");
  fs.writeFileSync(sqlPath, statements.join("\n") + "\n");
  console.log(`Wrote ${fresh.length} upserts → ${sqlPath}`);

  function apply(flag) {
    // Wrangler can choke on huge single files; chunk if needed.
    const chunkSize = 80;
    for (let i = 0; i < fresh.length; i += chunkSize) {
      const chunk = fresh.slice(i, i + chunkSize);
      const chunkPath = path.join(OUT_DIR, `osm-venues-chunk-${i}.sql`);
      fs.writeFileSync(chunkPath, chunk.map(venueInsertSql).join("\n") + "\n");
      console.log(`Applying chunk ${i / chunkSize + 1} (${chunk.length} rows)…`);
      const res = spawnSync(
        "npx",
        ["wrangler", "d1", "execute", "michiganhappyhour", flag, "--file", chunkPath],
        { cwd: root, stdio: "inherit", shell: process.platform === "win32" }
      );
      if (res.status !== 0) process.exit(res.status || 1);
    }
  }

  if (applyRemote) apply("--remote");
  if (applyLocal) apply("--local");
  if (!applyRemote && !applyLocal) {
    console.log("SQL ready. Re-run with --apply-remote to load into production D1.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
