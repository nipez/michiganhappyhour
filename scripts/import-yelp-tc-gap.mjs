#!/usr/bin/env node
/**
 * Import Traverse City–area venues found on Yelp Happy Hour search (via
 * secondary sources when Yelp blocks scrapers) that are missing from D1.
 *
 * Usage:
 *   node scripts/import-yelp-tc-gap.mjs              # write SQL
 *   node scripts/import-yelp-tc-gap.mjs --apply-remote
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT_DIR = path.join(root, "scripts", "generated");

const REGION_META = {
  "traverse-city": { name: "Traverse City", color: "#E8614D" },
  leelanau: { name: "Leelanau Peninsula", color: "#0D9488" },
  "old-mission": { name: "Old Mission Peninsula", color: "#7C3AED" },
  "elk-rapids": { name: "Elk Rapids & Torch Lake", color: "#2563EB" }
};

const ALL_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday"
];

/** Venues missing from D1 vs Yelp TC Happy Hour coverage (Aug 2026). */
const VENUES = [
  {
    name: "ParkShore Lounge",
    town: "Traverse City",
    address: "1401 US 31 N",
    category: "Cocktail Bar",
    region: "traverse-city",
    hh_start: "3:00 PM",
    hh_end: "7:00 PM",
    hh_days: ALL_DAYS,
    deals: ["Happy hour drink specials daily 3–7 PM"],
    vibe: "Resort lounge with daily happy hour and lake-area energy",
    lat: 44.7663142,
    lng: -85.6345477,
    phone: "(231) 947-3800"
  },
  {
    name: "Reflect Bistro",
    town: "Traverse City",
    address: "255 Munson Ave",
    category: "Restaurant",
    region: "traverse-city",
    hh_start: "4:00 PM",
    hh_end: "7:00 PM",
    hh_days: ALL_DAYS,
    deals: ["Happy hour daily 4–7 PM"],
    vibe: "Contemporary hotel bistro inside Cambria with a daily happy hour window",
    lat: 44.762657,
    lng: -85.585584,
    phone: "(231) 778-9100"
  },
  {
    name: "U & I Lounge",
    town: "Traverse City",
    address: "214 E Front St",
    category: "Cocktail Bar",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Classic downtown Front Street lounge — a longtime local favorite",
    lat: 44.7639568,
    lng: -85.6202998,
    phone: "(231) 946-8932"
  },
  {
    name: "The Pub TC",
    town: "Traverse City",
    address: "160 E Front St",
    category: "Taproom",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Irish-style pub downtown on Front Street",
    lat: 44.7635,
    lng: -85.6215
  },
  {
    name: "Nittolo's Little Italy",
    town: "Traverse City",
    address: "155 Garland St",
    category: "Restaurant",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Italian restaurant in the Warehouse District",
    lat: 44.7648,
    lng: -85.6235
  },
  {
    name: "PepeNero",
    town: "Traverse City",
    address: "700 Cottageview Dr",
    category: "Restaurant",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Mediterranean dining at Grand Traverse Commons",
    lat: 44.7505,
    lng: -85.6345
  },
  {
    name: "McGee's 72",
    town: "Williamsburg",
    address: "4341 M-72 E",
    category: "Restaurant",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["All-day happy hour specials"],
    vibe: "East-side pub with an all-day happy hour menu",
    lat: 44.7736643,
    lng: -85.4893569
  },
  {
    name: "Minervas",
    town: "Traverse City",
    address: "300 E State St",
    category: "Restaurant",
    region: "traverse-city",
    hh_start: "4:00 PM",
    hh_end: "6:00 PM",
    hh_days: ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    deals: [
      "Lounge happy hour Tue–Sat 4–6 PM",
      "Sunday lounge specials 2–9 PM"
    ],
    vibe: "Upscale Park Place Hotel restaurant with a neighborhood lounge happy hour",
    lat: 44.7626212,
    lng: -85.6178841,
    phone: "(231) 946-5093"
  },
  {
    name: "Red Ginger",
    town: "Traverse City",
    address: "237 E Front St",
    category: "Restaurant",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Downtown Asian fusion favorite on Front Street",
    lat: 44.7636,
    lng: -85.6198
  },
  {
    name: "Amical",
    town: "Traverse City",
    address: "229 E Front St",
    category: "Restaurant",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "French-inspired downtown restaurant and wine bar",
    lat: 44.7635,
    lng: -85.62
  },
  {
    name: "Bahia",
    town: "Traverse City",
    address: "12917 S West Bay Shore Dr",
    category: "Restaurant",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Latin-inspired waterfront dining on West Bay",
    lat: 44.7911574,
    lng: -85.6374667
  },
  {
    name: "Modern Bird",
    town: "Traverse City",
    address: "541 W Front St",
    category: "Restaurant",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Contemporary American small plates in Slabtown",
    lat: 44.7632,
    lng: -85.6305
  },
  {
    name: "Trattoria Stella",
    town: "Traverse City",
    address: "830 Cottageview Dr",
    category: "Restaurant",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Upscale Italian at Grand Traverse Commons — full menu at the bar",
    lat: 44.7505,
    lng: -85.6345,
    phone: "(231) 929-8989"
  },
  {
    name: "The Cooks' House",
    town: "Traverse City",
    address: "115 Wellington St",
    category: "Restaurant",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Intimate New American tasting-menu restaurant",
    lat: 44.7636066,
    lng: -85.6132561
  },
  {
    name: "The Towne Plaza",
    town: "Traverse City",
    address: "203 S Cass St",
    category: "Restaurant",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Casual downtown plaza dining",
    lat: 44.7625,
    lng: -85.622
  },
  {
    name: "Cellar & Flame",
    town: "Traverse City",
    address: "155 Garland St",
    category: "Restaurant",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Steakhouse in the Warehouse District",
    lat: 44.7648,
    lng: -85.6235
  },
  {
    name: "Poppycocks",
    town: "Traverse City",
    address: "128 E Front St",
    category: "Restaurant",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Longtime Front Street restaurant and bar",
    lat: 44.7638,
    lng: -85.6218
  },
  {
    name: "Chubby Unicorn",
    town: "Traverse City",
    address: "439 E Front St",
    category: "Cocktail Bar",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Playful downtown cocktail bar and eatery",
    lat: 44.7639,
    lng: -85.6155
  },
  {
    name: "The Butcher's Block by Maxbauer",
    town: "Traverse City",
    address: "144 Hall St",
    category: "Restaurant",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Butcher-shop restaurant from the Maxbauer family",
    lat: 44.765354,
    lng: -85.6270663
  },
  {
    name: "Farm Club",
    town: "Traverse City",
    address: "10051 Lake Leelanau Dr",
    category: "Brewery",
    region: "leelanau",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Farm brewery and restaurant just west of Traverse City",
    lat: 44.8,
    lng: -85.7
  },
  {
    name: "T-Bar & Grill",
    town: "Traverse City",
    address: "3100 Holiday Rd",
    category: "Restaurant",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Neighborhood bar and grill near Cherryland Center",
    lat: 44.74,
    lng: -85.58
  },
  {
    name: "Aerie Restaurant & Lounge",
    town: "Acme",
    address: "100 Grand Traverse Village Blvd",
    category: "Restaurant",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Grand Traverse Resort restaurant and lounge with bay views",
    lat: 44.7789704,
    lng: -85.488234
  },
  {
    name: "Bayview Inn Restaurant & Bar",
    town: "Suttons Bay",
    address: "909 S West Bay Shore Dr",
    category: "Restaurant",
    region: "leelanau",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Waterfront inn dining on West Bay Shore",
    lat: 44.9740158,
    lng: -85.6508234
  },
  {
    name: "Red Mesa Grill",
    town: "Traverse City",
    address: "1544 US 31 N",
    category: "Restaurant",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Latin American grill on US-31 North",
    lat: 44.78,
    lng: -85.62
  },
  {
    name: "Jack's Taproom",
    town: "Traverse City",
    address: "300 E State St",
    category: "Taproom",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Hotel taproom lounge at Park Place downtown",
    lat: 44.7626212,
    lng: -85.6178841
  },
  {
    name: "Boathouse Restaurant",
    town: "Traverse City",
    address: "14039 Peninsula Dr",
    category: "Restaurant",
    region: "old-mission",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Waterfront dining on Old Mission Peninsula",
    lat: 44.886,
    lng: -85.528
  },
  {
    name: "Osorio Tacos Y Salsas",
    town: "Traverse City",
    address: "129 E Front St",
    category: "Restaurant",
    region: "traverse-city",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Downtown taco spot with drink specials",
    lat: 44.7643343,
    lng: -85.6223318
  },
  {
    name: "Peninsula Cellars",
    town: "Traverse City",
    address: "11480 Center Rd",
    category: "Wine Bar",
    region: "old-mission",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Old Mission Peninsula tasting room in a schoolhouse",
    lat: 44.9,
    lng: -85.52
  },
  {
    name: "Mari Vineyards",
    town: "Traverse City",
    address: "8175 Center Rd",
    category: "Wine Bar",
    region: "old-mission",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Old Mission estate winery with tasting room",
    lat: 44.88,
    lng: -85.525
  },
  {
    name: "Amoritas Vineyards",
    town: "Lake Leelanau",
    address: "6701 E Duck Lake Rd",
    category: "Wine Bar",
    region: "leelanau",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Leelanau Peninsula winery tasting room",
    lat: 44.981221,
    lng: -85.719484
  },
  {
    name: "Suttons Bay Ciders",
    town: "Suttons Bay",
    address: "Suttons Bay, MI",
    category: "Cidery",
    region: "leelanau",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "Leelanau cidery tasting room with flights, pizza in summer, and scenic grounds",
    lat: 44.99,
    lng: -85.65,
    website: "https://suttonsbayciders.com/"
  },
  {
    name: "Heartwood Ciders",
    town: "Maple City",
    address: "13775 S Lautner Rd",
    category: "Cidery",
    region: "leelanau",
    hh_start: null,
    hh_end: null,
    hh_days: ALL_DAYS,
    deals: ["Ask about today's drink & food specials"],
    vibe: "New Leelanau cidery and tasting room with estate orchard",
    lat: 44.84,
    lng: -85.87
  }
];

function sqlStr(v) {
  if (v == null) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function slugify(name, town) {
  return `${name}-${town}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function wranglerJson(args) {
  const r = spawnSync("npx", ["wrangler", ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || "wrangler failed");
  const out = (r.stdout || "").trim();
  const start = out.indexOf("[");
  if (start < 0) throw new Error("No JSON from wrangler");
  return JSON.parse(out.slice(start));
}

function applySqlFile(filePath) {
  const r = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", "michiganhappyhour", "--remote", "--file", filePath],
    { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
  );
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || "apply failed");
  return r.stdout;
}

function main() {
  const applyRemote = process.argv.includes("--apply-remote");
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const existing = wranglerJson([
    "d1",
    "execute",
    "michiganhappyhour",
    "--remote",
    "--json",
    "--command",
    "SELECT id, name, town, region, status FROM venues"
  ])[0].results;

  const byNorm = new Map();
  for (const row of existing) {
    byNorm.set(normName(row.name), row);
  }

  const maxId = existing.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
  let nextId = maxId + 1;
  const inserts = [];
  const skipped = [];

  for (const v of VENUES) {
    const key = normName(v.name);
    const hit = byNorm.get(key);
    if (hit && hit.status === "published") {
      skipped.push({ name: v.name, reason: `already published #${hit.id}` });
      continue;
    }
    const meta = REGION_META[v.region] || REGION_META["traverse-city"];
    const spot = `../spots/${slugify(v.name, v.town)}.html`;
    const externalId = `yelp-gap:${slugify(v.name, v.town)}`;
    const id = hit?.id || nextId++;
    const days = JSON.stringify(v.hh_days?.length ? v.hh_days : ALL_DAYS);
    const deals = JSON.stringify(v.deals || []);
    if (hit) {
      inserts.push(
        `UPDATE venues SET name=${sqlStr(v.name)}, category=${sqlStr(v.category)}, region=${sqlStr(v.region)}, region_name=${sqlStr(meta.name)}, region_color=${sqlStr(meta.color)}, town=${sqlStr(v.town)}, address=${sqlStr(v.address)}, phone=COALESCE(${sqlStr(v.phone || null)}, phone), website=COALESCE(${sqlStr(v.website || null)}, website), hh_start=COALESCE(${sqlStr(v.hh_start)}, hh_start), hh_end=COALESCE(${sqlStr(v.hh_end)}, hh_end), hh_days=${sqlStr(days)}, deals=${sqlStr(deals)}, vibe=COALESCE(${sqlStr(v.vibe)}, vibe), lat=COALESCE(${v.lat ?? "NULL"}, lat), lng=COALESCE(${v.lng ?? "NULL"}, lng), spot_path=COALESCE(spot_path, ${sqlStr(spot)}), status='published', source=CASE WHEN source='curated' THEN 'curated' ELSE 'yelp' END, external_id=COALESCE(external_id, ${sqlStr(externalId)}), last_verified_at=date('now'), admin_notes=TRIM(COALESCE(admin_notes,'') || ${sqlStr("\nImported from Yelp TC Happy Hour gap fill 2026-08")}), updated_at=datetime('now') WHERE id=${id};`
      );
    } else {
      inserts.push(
        `INSERT INTO venues (id, name, category, region, region_name, region_color, town, address, phone, website, hh_start, hh_end, hh_days, deals, vibe, lat, lng, featured, collections, spot_path, status, source, external_id, last_verified_at, admin_notes, updated_at) VALUES (${id}, ${sqlStr(v.name)}, ${sqlStr(v.category)}, ${sqlStr(v.region)}, ${sqlStr(meta.name)}, ${sqlStr(meta.color)}, ${sqlStr(v.town)}, ${sqlStr(v.address)}, ${sqlStr(v.phone || null)}, ${sqlStr(v.website || null)}, ${sqlStr(v.hh_start)}, ${sqlStr(v.hh_end)}, ${sqlStr(days)}, ${sqlStr(deals)}, ${sqlStr(v.vibe)}, ${v.lat ?? "NULL"}, ${v.lng ?? "NULL"}, 0, '[]', ${sqlStr(spot)}, 'published', 'yelp', ${sqlStr(externalId)}, date('now'), ${sqlStr("Imported from Yelp TC Happy Hour gap fill 2026-08")}, datetime('now'));`
      );
    }
    byNorm.set(key, { id, name: v.name, status: "published" });
  }

  const sqlPath = path.join(OUT_DIR, "yelp-tc-gap.sql");
  const reportPath = path.join(OUT_DIR, "yelp-tc-gap-report.json");
  fs.writeFileSync(sqlPath, inserts.join("\n") + (inserts.length ? "\n" : ""));
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        to_insert: inserts.length,
        skipped,
        venues: VENUES.map((v) => v.name)
      },
      null,
      2
    )
  );
  console.log(`Wrote ${sqlPath} (${inserts.length} statements)`);
  console.log(`Skipped ${skipped.length}:`, skipped.map((s) => s.name).join(", ") || "(none)");

  if (applyRemote) {
    if (!inserts.length) {
      console.log("Nothing to apply.");
      return;
    }
    // Apply in chunks of 20
    const stmts = inserts;
    for (let i = 0; i < stmts.length; i += 20) {
      const chunk = path.join(OUT_DIR, `yelp-tc-gap-chunk-${i}.sql`);
      fs.writeFileSync(chunk, stmts.slice(i, i + 20).join("\n") + "\n");
      console.log(`Applying ${i + 1}-${Math.min(i + 20, stmts.length)}…`);
      applySqlFile(chunk);
    }
    console.log("Apply complete.");
  }
}

main();
