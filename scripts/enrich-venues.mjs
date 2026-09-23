#!/usr/bin/env node
/**
 * Enrich thin OSM venues:
 *   1) Re-fetch OSM tags → opening_hours, phone, website
 *   2) Optionally scrape venue websites for happy-hour windows (conservative)
 *
 * Usage:
 *   node scripts/enrich-venues.mjs                  # write SQL + report
 *   node scripts/enrich-venues.mjs --apply-remote
 *   node scripts/enrich-venues.mjs --osm-only
 *   node scripts/enrich-venues.mjs --web-only
 *   node scripts/enrich-venues.mjs --limit=50
 *   node scripts/enrich-venues.mjs --region=detroit
 *   node scripts/enrich-venues.mjs --region=port-huron,up-west,up-east
 *   node scripts/enrich-venues.mjs --town=Royal Oak,Ferndale
 *   node scripts/enrich-venues.mjs --missing-hh
 *   node scripts/enrich-venues.mjs --from-json=path.json
 *
 * Web scrape notes:
 *   - Crawls /happy-hour, /menus, etc. before homepage
 *   - Looks ~120 chars before "happy hour" (times often precede the label)
 *   - Prefers strong day ranges (Mon-Fri) over stray opening-hours day names
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT_DIR = path.join(root, "scripts", "generated");
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const UA = "MichiganHappyHour/1.0 (+https://michiganhappyhour.com; venue enrichment)";

const DAY_MAP = {
  mo: "Monday",
  tu: "Tuesday",
  we: "Wednesday",
  th: "Thursday",
  fr: "Friday",
  sa: "Saturday",
  su: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  tues: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  thur: "Thursday",
  thurs: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday"
};

const DAY_ORDER = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

function argValue(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function sqlStr(v) {
  if (v == null) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toDisplayTime(h, m) {
  const hour = Number(h);
  const min = Number(m || 0);
  const ap = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${String(min).padStart(2, "0")} ${ap}`;
}

function parseClock(token) {
  const t = String(token || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  let m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (m) {
    let h = Number(m[1]);
    const min = Number(m[2] || 0);
    const ap = m[3].toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return { h, m: min, display: toDisplayTime(h, min), minutes: h * 60 + min };
  }
  m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return { h, m: min, display: toDisplayTime(h, min), minutes: h * 60 + min };
  }
  m = t.match(/^(\d{1,2})(am|pm)$/i);
  if (m) {
    let h = Number(m[1]);
    const ap = m[2].toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return { h, m: 0, display: toDisplayTime(h, 0), minutes: h * 60 };
  }
  return null;
}

function expandDayRange(a, b) {
  const start = DAY_MAP[String(a).toLowerCase()];
  const end = DAY_MAP[String(b).toLowerCase()];
  if (!start || !end) return [];
  const si = DAY_ORDER.indexOf(start);
  const ei = DAY_ORDER.indexOf(end);
  if (si < 0 || ei < 0) return [];
  if (si <= ei) return DAY_ORDER.slice(si, ei + 1);
  return [...DAY_ORDER.slice(si), ...DAY_ORDER.slice(0, ei + 1)];
}

function parseDayList(chunk) {
  const text = String(chunk || "").toLowerCase();
  const days = new Set();
  let strongRange = false;
  // Mon-Fri / Tuesday-Friday / Tu-Th
  const rangeRe =
    /\b(mo|tu|we|th|fr|sa|su|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s*[-–—to]+\s*(mo|tu|we|th|fr|sa|su|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
  let m;
  while ((m = rangeRe.exec(text))) {
    const expanded = expandDayRange(m[1], m[2]);
    expanded.forEach((d) => days.add(d));
    // Prefer explicit ranges over stray opening-hours day names nearby.
    if (expanded.length >= 4) strongRange = true;
  }
  // Every day / daily (before singles so we don't skip intentional 7-day)
  if (/\b(every\s*day|daily|7\s*days)\b/i.test(text)) {
    DAY_ORDER.forEach((d) => days.add(d));
    return [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
  }
  // Skip singles when a clear multi-day range already filled the set
  // (avoids "Sunday 12pm-2am … Monday-Friday 3-6pm happy hour" picking up Sunday).
  if (!strongRange) {
    const singleRe =
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/gi;
    while ((m = singleRe.exec(text))) {
      const d = DAY_MAP[m[1].toLowerCase()];
      if (d) days.add(d);
    }
  }
  return [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
}

function parseClockPair(a, b, sharedMeridiem) {
  let startTok = String(a || "").trim();
  let endTok = String(b || "").trim();
  if (/^close$/i.test(endTok)) return null;

  // "4-6 pm" / "4 - 6PM" — meridiem only on the end (or shared group)
  const endHasMeridiem = /(am|pm)\s*$/i.test(endTok);
  const startHasMeridiem = /(am|pm)\s*$/i.test(startTok);
  const mer = sharedMeridiem || (endTok.match(/(am|pm)\s*$/i) || [])[1];
  if (mer && !startHasMeridiem) startTok = `${startTok}${mer}`;
  if (mer && !endHasMeridiem) endTok = `${endTok}${mer}`;

  const start = parseClock(startTok);
  const end = parseClock(endTok);
  if (!start || !end) return null;
  return { start, end };
}

function extractHappyHourFromText(rawText) {
  const text = String(rawText || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!/happy\s*hour/i.test(text)) return null;

  // Prefer windows that sit near "happy hour" — include lookbehind because
  // many sites list "Mon-Fri 3-6pm … happy hour" (times before the label).
  const windows = [];
  const hhRe = /happy\s*hour[\s\S]{0,220}/gi;
  let hm;
  while ((hm = hhRe.exec(text))) {
    windows.push(hm[0]);
  }
  for (const m of text.matchAll(/happy\s*hour\b/gi)) {
    const idx = m.index ?? 0;
    windows.push(text.slice(Math.max(0, idx - 120), idx + 280));
  }

  for (const win of windows) {
    const timeRe =
      /(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2})\s*[-–—to]+\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{1,2}:\d{2}|close)(?:\s*(am|pm))?/gi;
    let tm;
    while ((tm = timeRe.exec(win))) {
      const pair = parseClockPair(tm[1], tm[2], tm[3]);
      if (!pair) continue;
      const { start, end } = pair;
      const dur = end.minutes - start.minutes;
      // Typical happy hour: starts 14:00–18:00, 1–5 hours, ends by 21:00
      if (start.minutes < 14 * 60 || start.minutes > 18 * 60) continue;
      if (end.minutes > 21 * 60) continue;
      if (dur < 60 || dur > 5 * 60) continue;

      const dayChunk = win.slice(0, tm.index + 1) + " " + win.slice(0, 80);
      let days = parseDayList(dayChunk);
      if (!days.length) days = parseDayList(win);
      if (!days.length) {
        // Default weekdays when HH is advertised without days
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
      }

      const dealBits = [];
      const dealRe =
        /(\d{1,2}%\s*off[^.]{0,40}|half[-\s]?off[^.]{0,40}|\$\d+(?:\.\d{2})?\s+(?:off\s+)?[a-z][^.]{0,35}|\$\d+(?:\.\d{2})?\s+[a-z][^.]{0,30})/gi;
      let dm;
      while ((dm = dealRe.exec(win)) && dealBits.length < 4) {
        const bit = dm[0].replace(/\s+/g, " ").trim();
        if (
          bit.length >= 8 &&
          bit.length < 70 &&
          !/\b(pm|am|hosted|meet|rotating|book a)\b/i.test(bit)
        ) {
          dealBits.push(bit);
        }
      }

      // Require a real weekday spread — single-day scrapes are usually noise.
      if (days.length < 2) continue;
      // Deals preferred; allow clear multi-day windows without them when
      // the happy-hour label is adjacent (still require 4+ days).
      if (!dealBits.length && days.length < 4) continue;

      return {
        hh_start: start.display,
        hh_end: end.display,
        hh_days: days,
        deals: dealBits,
        confidence: "web"
      };
    }
  }
  return null;
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
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
    const buf = await res.arrayBuffer();
    // Wix/Squarespace often bury HH copy past the first 250KB of shell/CSS.
    const bytes = new Uint8Array(buf).slice(0, 900000);
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } finally {
    clearTimeout(timer);
  }
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function overpassByIds(ids) {
  // ids: [{type, id}]
  if (!ids.length) return [];
  const body =
    `[out:json][timeout:90];(` +
    ids.map((x) => `${x.type}(${x.id});`).join("") +
    `);out tags;`;
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: body })
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  const data = await res.json();
  return data.elements || [];
}

function wranglerJson(args) {
  const r = spawnSync("npx", ["wrangler", ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || "wrangler failed");
  }
  const out = (r.stdout || "").trim();
  const start = out.indexOf("[");
  if (start < 0) throw new Error("No JSON from wrangler");
  return JSON.parse(out.slice(start));
}

function parseListArg(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function sqlInList(values) {
  return values.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(",");
}

function loadOsmVenuesFromJson(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const rows = Array.isArray(raw) ? raw : raw.results || raw.venues || [];
  if (!Array.isArray(rows)) throw new Error(`Invalid JSON venue dump: ${filePath}`);
  return rows;
}

function loadOsmVenues({ regions, towns, missingHh, limit, fromJson }) {
  if (fromJson) {
    let rows = loadOsmVenuesFromJson(fromJson);
    if (regions.length) {
      const set = new Set(regions);
      rows = rows.filter((r) => set.has(r.region));
    }
    if (towns.length) {
      const set = new Set(towns.map((t) => t.toLowerCase()));
      rows = rows.filter((r) => set.has(String(r.town || "").toLowerCase()));
    }
    if (missingHh) {
      rows = rows.filter((r) => !String(r.hh_start || "").trim());
    }
    rows.sort((a, b) =>
      `${a.region}|${a.name}`.localeCompare(`${b.region}|${b.name}`)
    );
    if (limit) rows = rows.slice(0, limit);
    return rows;
  }

  let sql =
    "SELECT id, name, town, region, website, phone, opening_hours, hh_start, hh_end, deals, external_id, source FROM venues WHERE status='published' AND source='osm' AND external_id IS NOT NULL";
  if (regions.length === 1) {
    sql += ` AND region='${regions[0].replace(/'/g, "''")}'`;
  } else if (regions.length > 1) {
    sql += ` AND region IN (${sqlInList(regions)})`;
  }
  if (towns.length === 1) {
    sql += ` AND town='${towns[0].replace(/'/g, "''")}'`;
  } else if (towns.length > 1) {
    sql += ` AND town IN (${sqlInList(towns)})`;
  }
  if (missingHh) {
    sql += " AND (hh_start IS NULL OR TRIM(hh_start)='')";
  }
  sql += " ORDER BY region, name";
  if (limit) sql += ` LIMIT ${Number(limit)}`;
  const data = wranglerJson([
    "d1",
    "execute",
    "michiganhappyhour",
    "--remote",
    "--json",
    "--command",
    sql
  ]);
  return data[0]?.results || [];
}

function applySqlFile(filePath, remote) {
  const args = [
    "d1",
    "execute",
    "michiganhappyhour",
    remote ? "--remote" : "--local",
    "--file",
    filePath
  ];
  const r = spawnSync("npx", ["wrangler", ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || "apply failed");
  }
  return r.stdout;
}

async function enrichFromOsm(rows) {
  const updates = [];
  const parsed = rows
    .map((r) => {
      const m = String(r.external_id || "").match(/^osm:(node|way|relation)\/(\d+)$/);
      if (!m) return null;
      return { row: r, type: m[1], id: m[2] };
    })
    .filter(Boolean);

  const CHUNK = 80;
  for (let i = 0; i < parsed.length; i += CHUNK) {
    const chunk = parsed.slice(i, i + CHUNK);
    let elements = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        elements = await overpassByIds(chunk.map((c) => ({ type: c.type, id: c.id })));
        break;
      } catch (err) {
        console.warn(`Overpass chunk ${i} attempt ${attempt + 1}:`, err.message);
        await sleep(2000 * (attempt + 1));
      }
    }
    const byKey = new Map(elements.map((e) => [`${e.type}/${e.id}`, e]));
    for (const c of chunk) {
      const el = byKey.get(`${c.type}/${c.id}`);
      if (!el) continue;
      const tags = el.tags || {};
      const opening_hours = tags.opening_hours || tags["opening_hours:kitchen"] || null;
      const phone = tags.phone || tags["contact:phone"] || null;
      const website = tags.website || tags["contact:website"] || tags.url || null;
      const patch = {};
      if (opening_hours && opening_hours !== c.row.opening_hours) patch.opening_hours = opening_hours;
      if (phone && !c.row.phone) patch.phone = phone;
      if (website && !c.row.website) patch.website = website;
      if (Object.keys(patch).length) {
        updates.push({ id: c.row.id, name: c.row.name, patch, source: "osm" });
      }
    }
    console.log(`OSM processed ${Math.min(i + CHUNK, parsed.length)}/${parsed.length}`);
    await sleep(1200);
  }
  return updates;
}

const HH_PATH_SUFFIXES = ["/happy-hour", "/happyhour", "/specials", "/menu", "/menus", ""];

function websiteCandidates(website) {
  let url = String(website || "").trim();
  if (!url) return [];
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  let origin;
  let basePath = "";
  try {
    const u = new URL(url);
    origin = u.origin;
    basePath = u.pathname.replace(/\/$/, "");
  } catch {
    return [url];
  }
  const urls = [];
  const push = (u) => {
    if (!urls.includes(u)) urls.push(u);
  };
  // Prefer dedicated HH/menu paths before the homepage shell.
  for (const suffix of HH_PATH_SUFFIXES) {
    if (!suffix) {
      push(url);
      continue;
    }
    push(origin + suffix);
    if (basePath && basePath !== "/") push(origin + basePath + suffix);
  }
  push(url);
  return urls;
}

async function scrapeHappyHour(website) {
  const urls = websiteCandidates(website);
  for (const url of urls) {
    try {
      const html = await fetchText(url);
      const text = htmlToText(html);
      const hh = extractHappyHourFromText(text);
      if (hh) return { hh, url };
    } catch {
      // try next path
    }
    await sleep(150);
  }
  return null;
}

async function enrichFromWeb(rows) {
  const updates = [];
  const candidates = rows.filter((r) => r.website && !String(r.hh_start || "").trim());
  console.log(`Web scrape candidates: ${candidates.length}`);
  for (let i = 0; i < candidates.length; i++) {
    const r = candidates[i];
    try {
      const hit = await scrapeHappyHour(r.website);
      if (hit) {
        const { hh } = hit;
        const patch = {
          hh_start: hh.hh_start,
          hh_end: hh.hh_end,
          hh_days: JSON.stringify(hh.hh_days),
          last_verified_at: new Date().toISOString().slice(0, 10),
          vibe: "Happy hour details pulled from their website — confirm when you visit"
        };
        if (hh.deals?.length) patch.deals = JSON.stringify(hh.deals);
        updates.push({
          id: r.id,
          name: r.name,
          patch,
          source: "web",
          sample: `${hh.hh_start}-${hh.hh_end} (${hh.hh_days.length} days)`
        });
        console.log(`  ✓ ${r.name}: ${hh.hh_start}–${hh.hh_end}`);
      } else {
        console.log(`  · ${r.name}: no confident HH`);
      }
    } catch (err) {
      console.log(`  ✗ ${r.name}: ${err.message}`);
    }
    if ((i + 1) % 10 === 0) await sleep(500);
    else await sleep(200);
  }
  return updates;
}

function updatesToSql(updates) {
  // D1 remote --file rejects BEGIN/COMMIT; emit plain UPDATE statements.
  const lines = [];
  for (const u of updates) {
    const sets = [];
    for (const [k, v] of Object.entries(u.patch)) {
      sets.push(`${k}=${sqlStr(v)}`);
    }
    sets.push("updated_at=datetime('now')");
    lines.push(`UPDATE venues SET ${sets.join(", ")} WHERE id=${Number(u.id)} AND source='osm';`);
  }
  return lines.join("\n");
}

function applySqlBatches(sqlText, remote) {
  const stmts = sqlText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^BEGIN/i.test(l) && !/^COMMIT/i.test(l));
  const CHUNK = 40;
  for (let i = 0; i < stmts.length; i += CHUNK) {
    const chunkPath = path.join(OUT_DIR, `enrich-venues-chunk-${i}.sql`);
    fs.writeFileSync(chunkPath, stmts.slice(i, i + CHUNK).join("\n") + "\n");
    console.log(`Applying statements ${i + 1}-${Math.min(i + CHUNK, stmts.length)}…`);
    applySqlFile(chunkPath, remote);
  }
}

async function main() {
  const applyRemote = process.argv.includes("--apply-remote");
  const applyLocal = process.argv.includes("--apply-local");
  const osmOnly = process.argv.includes("--osm-only");
  const webOnly = process.argv.includes("--web-only");
  const missingHh = process.argv.includes("--missing-hh");
  const regions = parseListArg(argValue("region"));
  const towns = parseListArg(argValue("town"));
  const fromJson = argValue("from-json");
  const limit = argValue("limit") ? Number(argValue("limit")) : null;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(
    fromJson
      ? `Loading OSM venues from ${fromJson}…`
      : "Loading OSM venues from D1…"
  );
  if (regions.length) console.log(`  regions: ${regions.join(", ")}`);
  if (towns.length) console.log(`  towns: ${towns.join(", ")}`);
  if (missingHh) console.log("  filter: missing hh_start only");
  const rows = loadOsmVenues({ regions, towns, missingHh, limit, fromJson });
  console.log(`Loaded ${rows.length} venues`);

  let updates = [];
  if (!webOnly) {
    console.log("Enriching from OSM tags…");
    updates = updates.concat(await enrichFromOsm(rows));
  }
  if (!osmOnly) {
    console.log("Enriching from websites…");
    // Merge OSM website fills into in-memory rows for scrape
    const byId = new Map(rows.map((r) => [r.id, { ...r }]));
    for (const u of updates) {
      Object.assign(byId.get(u.id) || {}, u.patch);
    }
    updates = updates.concat(await enrichFromWeb([...byId.values()]));
  }

  // Merge patches per id
  const merged = new Map();
  for (const u of updates) {
    const cur = merged.get(u.id) || { id: u.id, name: u.name, patch: {}, sources: [] };
    Object.assign(cur.patch, u.patch);
    cur.sources.push(u.source);
    if (u.sample) cur.sample = u.sample;
    merged.set(u.id, cur);
  }
  const finalUpdates = [...merged.values()];

  const report = {
    generated_at: new Date().toISOString(),
    venues_scanned: rows.length,
    updated: finalUpdates.length,
    with_hh: finalUpdates.filter((u) => u.patch.hh_start).length,
    with_opening_hours: finalUpdates.filter((u) => u.patch.opening_hours).length,
    samples: finalUpdates
      .filter((u) => u.patch.hh_start)
      .slice(0, 40)
      .map((u) => ({ id: u.id, name: u.name, ...u.patch, sample: u.sample }))
  };

  const sqlPath = path.join(OUT_DIR, "enrich-venues.sql");
  const reportPath = path.join(OUT_DIR, "enrich-venues-report.json");
  fs.writeFileSync(sqlPath, updatesToSql(finalUpdates));
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Wrote ${sqlPath} (${finalUpdates.length} updates)`);
  console.log(`Wrote ${reportPath}`);
  console.log(
    `HH filled: ${report.with_hh}, opening_hours: ${report.with_opening_hours}`
  );

  if (applyRemote || applyLocal) {
    if (!finalUpdates.length) {
      console.log("Nothing to apply.");
      return;
    }
    console.log(`Applying to ${applyRemote ? "remote" : "local"} D1…`);
    applySqlBatches(fs.readFileSync(sqlPath, "utf8"), applyRemote);
    console.log("Apply complete.");
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { extractHappyHourFromText, htmlToText, parseDayList };
