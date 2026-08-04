#!/usr/bin/env node
/**
 * Rebuild sitemap.xml from published D1 venues + static site pages.
 *
 * Usage:
 *   node scripts/generate-sitemap.mjs              # remote D1 (default)
 *   node scripts/generate-sitemap.mjs --local
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const OUT = path.join(root, "sitemap.xml");
const BASE = "https://michiganhappyhour.com";

const REGIONS = [
  "traverse-city",
  "grand-rapids",
  "ann-arbor",
  "detroit",
  "kalamazoo",
  "lansing",
  "holland",
  "muskegon",
  "marquette",
  "tri-cities",
  "flint",
  "leelanau",
  "charlevoix-petoskey",
  "old-mission",
  "elk-rapids",
  "frankfort-benzie",
  "mackinaw",
  "bellaire-mancelona"
];

const STATIC = [
  { loc: "/", priority: "1.0", changefreq: "weekly" },
  ...REGIONS.map((id) => ({
    loc: `/regions/${id}`,
    priority: "0.8",
    changefreq: "weekly"
  })),
  { loc: "/collections/best-breweries", priority: "0.75", changefreq: "weekly" },
  { loc: "/collections/best-patios", priority: "0.7", changefreq: "weekly" },
  { loc: "/collections/best-late-night", priority: "0.7", changefreq: "weekly" },
  { loc: "/blog/", priority: "0.8", changefreq: "weekly" },
  { loc: "/blog/detroit-happy-hour-guide", priority: "0.75", changefreq: "weekly" },
  { loc: "/blog/grand-rapids-happy-hour-guide", priority: "0.75", changefreq: "weekly" },
  { loc: "/blog/ann-arbor-happy-hour-guide", priority: "0.75", changefreq: "weekly" },
  { loc: "/blog/lansing-happy-hour-guide", priority: "0.75", changefreq: "weekly" },
  { loc: "/blog/kalamazoo-happy-hour-guide", priority: "0.75", changefreq: "weekly" },
  { loc: "/blog/flint-happy-hour-guide", priority: "0.75", changefreq: "weekly" },
  { loc: "/blog/traverse-city-happy-hour-guide", priority: "0.75", changefreq: "weekly" },
  { loc: "/blog/best-brewery-happy-hours-michigan", priority: "0.75", changefreq: "weekly" },
  { loc: "/blog/michigan-happy-hour-laws", priority: "0.75", changefreq: "weekly" },
  { loc: "/map/", priority: "0.7", changefreq: "weekly" },
  { loc: "/submit/", priority: "0.5", changefreq: "monthly" },
  { loc: "/for-business/", priority: "0.6", changefreq: "monthly" }
];

function slugify(name, town) {
  return `${name}-${town}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function spotSlug(row) {
  const raw = String(row.spot_path || "").trim();
  if (raw) {
    const base = raw.split("/").pop() || "";
    if (base.endsWith(".html")) return base.slice(0, -5);
    if (base) return base;
  }
  return slugify(row.name || "spot", row.town || "michigan");
}

function dayStamp(iso) {
  if (!iso) return new Date().toISOString().slice(0, 10);
  const d = String(iso).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Date().toISOString().slice(0, 10);
}

function fetchVenues(local) {
  const flag = local ? "--local" : "--remote";
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
      "SELECT name, town, spot_path, updated_at, created_at FROM venues WHERE status = 'published' ORDER BY name COLLATE NOCASE ASC"
    ],
    { cwd: root, encoding: "utf8", shell: process.platform === "win32" }
  );
  if (res.status !== 0) {
    throw new Error(res.stderr || res.stdout || "wrangler d1 failed");
  }
  const parsed = JSON.parse(res.stdout);
  return parsed[0]?.results || [];
}

function urlEntry(loc, { priority = "0.7", changefreq = "weekly", lastmod } = {}) {
  const lm = lastmod || new Date().toISOString().slice(0, 10);
  return `  <url><loc>${BASE}${loc}</loc><priority>${priority}</priority><lastmod>${lm}</lastmod><changefreq>${changefreq}</changefreq></url>`;
}

function main() {
  const local = process.argv.includes("--local");
  const venues = fetchVenues(local);
  const today = new Date().toISOString().slice(0, 10);

  const seen = new Set();
  const spotEntries = [];
  for (const v of venues) {
    const slug = spotSlug(v);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    spotEntries.push(
      urlEntry(`/spots/${slug}`, {
        priority: "0.7",
        changefreq: "weekly",
        lastmod: dayStamp(v.updated_at || v.created_at || today)
      })
    );
  }

  // Static pages after home+regions are already in STATIC; insert spots after regions
  const homeAndRegions = STATIC.filter(
    (s) => s.loc === "/" || s.loc.startsWith("/regions/")
  );
  const restStatic = STATIC.filter(
    (s) => s.loc !== "/" && !s.loc.startsWith("/regions/")
  );

  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...homeAndRegions.map((s) =>
      urlEntry(s.loc, { ...s, lastmod: today })
    ),
    ...spotEntries,
    ...restStatic.map((s) => urlEntry(s.loc, { ...s, lastmod: today })),
    `</urlset>`,
    ``
  ];

  fs.writeFileSync(OUT, lines.join("\n"));
  console.log(
    `Wrote ${OUT}: ${spotEntries.length} spots + ${STATIC.length} static pages (${venues.length} published venues queried)`
  );
  if (spotEntries.length < venues.length) {
    console.warn(
      `Note: skipped ${venues.length - spotEntries.length} duplicate spot slugs`
    );
  }
}

main();
