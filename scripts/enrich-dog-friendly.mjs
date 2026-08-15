#!/usr/bin/env node
/**
 * Cross-reference venues for dog-friendly signals.
 *
 * Sources:
 *   1) OSM — statewide dog=yes / dogs=yes on bars/pubs/restaurants/breweries +
 *      re-check OSM tags for venues with external_id osm:*
 *   2) Website keyword scan — strong / weak phrase matches
 *
 * Usage:
 *   node scripts/enrich-dog-friendly.mjs --from=scripts/generated/venues-dog-input.json
 *   node scripts/enrich-dog-friendly.mjs --from=... --apply-sql   # write SQL only
 *   node scripts/enrich-dog-friendly.mjs --from=... --web-only
 *   node scripts/enrich-dog-friendly.mjs --from=... --osm-only
 *   node scripts/enrich-dog-friendly.mjs --from=... --limit=40
 *
 * Apply strong hits yourself via D1 (script prints UPDATE statements + report).
 * Does NOT clear existing dog_friendly=1.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT_DIR = path.join(root, "scripts", "generated");
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const UA = "MichiganHappyHour/1.0 (+https://michiganhappyhour.com; dog-friendly enrichment)";

const STRONG_PHRASES = [
  /\bdogs?\s+welcome\b/i,
  /\bdog[\s-]?friendly\b/i,
  /\bpets?\s+welcome\b/i,
  /\bpets?\s+allowed\b/i,
  /\ballows?\s+dogs?\b/i,
  /\bdogs?\s+allowed\b/i,
  /\bdogs?\s+ok\b/i,
  /\bleashed\s+dogs?\s+(are\s+)?welcome\b/i,
  /\bwe\s+welcome\s+(your\s+)?dogs?\b/i
];

const WEAK_PHRASES = [
  /\bpets?\b/i,
  /\bdogs?\b/i,
  /\bpuppies\b/i,
  /\bfurry\s+friends\b/i
];

const NEGATIVE_PHRASES = [
  /\bno\s+dogs?\b/i,
  /\bno\s+pets?\b/i,
  /\bdogs?\s+not\s+allowed\b/i,
  /\bpets?\s+not\s+allowed\b/i,
  /\bservice\s+animals?\s+only\b/i,
  /\bno\s+animals\b/i
];

function argValue(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function sqlStr(v) {
  if (v == null) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

function haversineMi(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function isDogTag(tags = {}) {
  return (
    tags.dog === "yes" ||
    tags.dogs === "yes" ||
    tags["dog:friendly"] === "yes" ||
    tags["dogs:welcome"] === "yes"
  );
}

async function overpass(query, attempt = 1) {
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "data=" + encodeURIComponent(query)
  });
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 5) throw new Error(`Overpass ${res.status} after retries`);
    const wait = 4000 * attempt;
    console.warn(`  Overpass ${res.status} — retry in ${wait}ms`);
    await sleep(wait);
    return overpass(query, attempt + 1);
  }
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  return res.json();
}

async function fetchStatewideOsmDogs() {
  const query = `
[out:json][timeout:120];
area["name"="Michigan"]["admin_level"="4"]->.a;
(
  nwr["dog"="yes"]["amenity"~"^(bar|pub|biergarten|restaurant|cafe|fast_food|nightclub|wine_bar)$"](area.a);
  nwr["dogs"="yes"]["amenity"~"^(bar|pub|biergarten|restaurant|cafe|fast_food|nightclub|wine_bar)$"](area.a);
  nwr["dog:friendly"="yes"]["amenity"~"^(bar|pub|biergarten|restaurant|cafe|fast_food|nightclub|wine_bar)$"](area.a);
  nwr["dog"="yes"]["craft"="brewery"](area.a);
  nwr["dogs"="yes"]["craft"="brewery"](area.a);
  nwr["dog"="yes"]["industrial"="brewery"](area.a);
  nwr["dogs"="yes"]["industrial"="brewery"](area.a);
);
out center tags;
`.trim();
  const data = await overpass(query);
  return (data.elements || []).map((el) => {
    const tags = el.tags || {};
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    return {
      external_id: `osm:${el.type}/${el.id}`,
      name: tags.name || null,
      town: tags["addr:city"] || tags["addr:town"] || null,
      lat,
      lng,
      tags
    };
  });
}

async function overpassByIds(ids) {
  if (!ids.length) return [];
  const body =
    `[out:json][timeout:90];(` +
    ids.map((x) => `${x.type}(${x.id});`).join("") +
    `);out tags;`;
  const data = await overpass(body);
  return data.elements || [];
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml"
      },
      redirect: "follow"
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (!/text|html|xml/i.test(ct) && ct) throw new Error(`skip ${ct}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function scoreWebsiteText(text) {
  if (!text || text.length < 40) return { level: null, hits: [] };
  const hits = [];
  for (const re of NEGATIVE_PHRASES) {
    const m = text.match(re);
    if (m) hits.push({ level: "negative", phrase: m[0] });
  }
  if (hits.some((h) => h.level === "negative")) {
    return { level: "negative", hits };
  }
  for (const re of STRONG_PHRASES) {
    const m = text.match(re);
    if (m) hits.push({ level: "strong", phrase: m[0] });
  }
  if (hits.some((h) => h.level === "strong")) {
    return { level: "strong", hits: hits.filter((h) => h.level === "strong") };
  }
  // Weak: require dog/pet near friendly/welcome/patio context — avoid random "hot dog"
  const weakCtx =
    /\b(dog|dogs|pet|pets)\b.{0,40}\b(friendly|welcome|allowed|ok|okay|patio|outdoor|deck)\b/i.test(
      text
    ) ||
    /\b(friendly|welcome|allowed|ok|okay)\b.{0,40}\b(dog|dogs|pet|pets)\b/i.test(text);
  if (weakCtx) {
    for (const re of WEAK_PHRASES) {
      const m = text.match(re);
      if (m) hits.push({ level: "weak", phrase: m[0] });
    }
    if (hits.length) return { level: "weak", hits };
  }
  return { level: null, hits: [] };
}

function matchOsmToVenues(osmDogs, venues) {
  const strong = [];
  for (const o of osmDogs) {
    if (!o.name || o.lat == null || o.lng == null) continue;
    const on = normName(o.name);
    let best = null;
    for (const v of venues) {
      if (v.dog_friendly) continue;
      if (v.lat == null || v.lng == null) continue;
      const vn = normName(v.name);
      const nameClose = vn === on || vn.includes(on) || on.includes(vn);
      if (!nameClose) continue;
      const dist = haversineMi(Number(v.lat), Number(v.lng), Number(o.lat), Number(o.lng));
      if (dist > 1.2) continue;
      if (!best || dist < best.dist) best = { venue: v, dist, osm: o };
    }
    // Also match by external_id
    const byExt = venues.find((v) => v.external_id && v.external_id === o.external_id);
    if (byExt && !byExt.dog_friendly) {
      strong.push({
        id: byExt.id,
        name: byExt.name,
        town: byExt.town,
        source: "osm_id",
        detail: o.external_id
      });
      continue;
    }
    if (best) {
      strong.push({
        id: best.venue.id,
        name: best.venue.name,
        town: best.venue.town,
        source: "osm_geo",
        detail: `${o.external_id} ~${best.dist.toFixed(2)}mi`
      });
    }
  }
  return strong;
}

async function enrichOsmIds(venues) {
  const strong = [];
  const parsed = venues
    .filter((v) => !v.dog_friendly)
    .map((v) => {
      const m = String(v.external_id || "").match(/^osm:(node|way|relation)\/(\d+)$/);
      if (!m) return null;
      return { venue: v, type: m[1], id: m[2] };
    })
    .filter(Boolean);

  const CHUNK = 80;
  for (let i = 0; i < parsed.length; i += CHUNK) {
    const chunk = parsed.slice(i, i + CHUNK);
    let elements = [];
    try {
      elements = await overpassByIds(chunk.map((c) => ({ type: c.type, id: c.id })));
    } catch (err) {
      console.warn(`OSM id chunk ${i} failed:`, err.message);
      await sleep(3000);
      continue;
    }
    const byKey = new Map(elements.map((e) => [`${e.type}/${e.id}`, e]));
    for (const c of chunk) {
      const el = byKey.get(`${c.type}/${c.id}`);
      if (!el?.tags) continue;
      if (isDogTag(el.tags)) {
        strong.push({
          id: c.venue.id,
          name: c.venue.name,
          town: c.venue.town,
          source: "osm_tags",
          detail: c.venue.external_id
        });
      }
    }
    console.log(`OSM id tags checked ${Math.min(i + CHUNK, parsed.length)}/${parsed.length}`);
    await sleep(1200);
  }
  return strong;
}

async function enrichWebsites(venues, limit) {
  const strong = [];
  const maybe = [];
  const negative = [];
  let candidates = venues.filter(
    (v) => !v.dog_friendly && v.website && String(v.website).trim()
  );
  if (limit) candidates = candidates.slice(0, limit);
  console.log(`Website scan candidates: ${candidates.length}`);

  for (let i = 0; i < candidates.length; i++) {
    const v = candidates[i];
    let url = String(v.website).trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    try {
      const html = await fetchText(url);
      const text = htmlToText(html);
      const scored = scoreWebsiteText(text);
      if (scored.level === "strong") {
        strong.push({
          id: v.id,
          name: v.name,
          town: v.town,
          source: "web_strong",
          detail: scored.hits.map((h) => h.phrase).join("; "),
          url
        });
        console.log(`  ✓ strong ${v.name}: ${scored.hits[0]?.phrase}`);
      } else if (scored.level === "weak") {
        maybe.push({
          id: v.id,
          name: v.name,
          town: v.town,
          source: "web_weak",
          detail: scored.hits.map((h) => h.phrase).slice(0, 3).join("; "),
          url
        });
        console.log(`  ~ weak ${v.name}`);
      } else if (scored.level === "negative") {
        negative.push({
          id: v.id,
          name: v.name,
          town: v.town,
          source: "web_negative",
          detail: scored.hits.map((h) => h.phrase).join("; "),
          url
        });
        console.log(`  ✗ no-pets ${v.name}`);
      } else {
        console.log(`  · ${v.name}: no signal`);
      }
    } catch (err) {
      console.log(`  ✗ ${v.name}: ${err.message}`);
    }
    if ((i + 1) % 10 === 0) await sleep(600);
    else await sleep(250);
  }
  return { strong, maybe, negative };
}

function dedupeHits(hits) {
  const byId = new Map();
  for (const h of hits) {
    const prev = byId.get(h.id);
    if (!prev) byId.set(h.id, h);
    else byId.set(h.id, { ...prev, detail: `${prev.detail} | ${h.detail}`, source: `${prev.source}+${h.source}` });
  }
  return [...byId.values()];
}

async function main() {
  const fromPath = argValue("from");
  if (!fromPath) {
    console.error("Required: --from=path/to/venues.json (array or {results:[]})");
    process.exit(1);
  }
  const osmOnly = process.argv.includes("--osm-only");
  const webOnly = process.argv.includes("--web-only");
  const limit = argValue("limit") ? Number(argValue("limit")) : null;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const raw = JSON.parse(fs.readFileSync(path.resolve(root, fromPath), "utf8"));
  const venues = Array.isArray(raw) ? raw : raw.results || raw.venues || [];
  console.log(`Loaded ${venues.length} venues (${venues.filter((v) => v.dog_friendly).length} already dog-friendly)`);

  let strong = [];
  let maybe = [];
  let negative = [];
  let osmDogs = [];

  if (!webOnly) {
    console.log("Fetching statewide OSM dog-friendly food/drink…");
    osmDogs = await fetchStatewideOsmDogs();
    console.log(`  OSM food/drink dog tags: ${osmDogs.length}`);
    strong = strong.concat(matchOsmToVenues(osmDogs, venues));
    console.log("Re-checking OSM tags on existing osm:* venues…");
    strong = strong.concat(await enrichOsmIds(venues));
  }

  // Curated copy already on the listing
  for (const v of venues) {
    if (v.dog_friendly) continue;
    const blob = `${v.vibe || ""} ${v.deals || ""} ${v.admin_notes || ""}`;
    const scored = scoreWebsiteText(blob);
    if (scored.level === "strong") {
      strong.push({
        id: v.id,
        name: v.name,
        town: v.town,
        source: "listing_text",
        detail: scored.hits.map((h) => h.phrase).join("; ")
      });
    }
  }

  if (!osmOnly) {
    const web = await enrichWebsites(venues, limit);
    strong = strong.concat(web.strong);
    maybe = web.maybe;
    negative = web.negative;
  }

  strong = dedupeHits(strong).filter((h) => {
    const v = venues.find((x) => x.id === h.id);
    return v && !v.dog_friendly;
  });

  const note = `\nDog-friendly via auto-enrich ${new Date().toISOString().slice(0, 10)}`;
  const sql = strong
    .map(
      (h) =>
        `UPDATE venues SET dog_friendly=1, admin_notes=TRIM(COALESCE(admin_notes,'') || ${sqlStr(note + " (" + h.source + ")")} ), updated_at=datetime('now') WHERE id=${Number(h.id)} AND COALESCE(dog_friendly,0)=0;`
    )
    .join("\n");

  const sqlPath = path.join(OUT_DIR, "dog-friendly-strong.sql");
  const reportPath = path.join(OUT_DIR, "dog-friendly-report.json");
  fs.writeFileSync(sqlPath, sql ? sql + "\n" : "-- no strong hits\n");
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        strong_count: strong.length,
        maybe_count: maybe.length,
        negative_count: negative.length,
        osm_food_drink_count: osmDogs.length,
        strong,
        maybe,
        negative,
        osm_dogs: osmDogs
      },
      null,
      2
    )
  );

  console.log(`\nStrong auto-set candidates: ${strong.length} → ${sqlPath}`);
  console.log(`Maybe (review in Admin): ${maybe.length}`);
  console.log(`Explicit no-pets on site: ${negative.length}`);
  console.log(`Report: ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
