#!/usr/bin/env node
/**
 * Seed D1 `venues` from homepage `const L` + map SPOTS metadata.
 *
 * Usage:
 *   node scripts/seed-venues.mjs              # write migrations seed SQL to /tmp
 *   node scripts/seed-venues.mjs --apply-local
 *   node scripts/seed-venues.mjs --apply-remote
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function extractL(html) {
  const start = html.indexOf("const L=[");
  if (start < 0) throw new Error("const L not found in index.html");
  const end = html.indexOf("\n];", start);
  if (end < 0) throw new Error("end of L array not found");
  const code = html.slice(start, end + 2);
  return new Function(`${code}; return L;`)();
}

function extractSpots(html) {
  const key = "var SPOTS = ";
  const start = html.indexOf(key);
  if (start < 0) throw new Error("SPOTS not found");
  const from = start + key.length;
  const end = html.indexOf("];", from) + 1;
  return JSON.parse(html.slice(from, end));
}

function sqlStr(v) {
  if (v == null) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function main() {
  const applyLocal = process.argv.includes("--apply-local");
  const applyRemote = process.argv.includes("--apply-remote");

  const L = extractL(fs.readFileSync(path.join(root, "index.html"), "utf8"));
  const SPOTS = extractSpots(fs.readFileSync(path.join(root, "map/index.html"), "utf8"));
  const byKey = Object.fromEntries(SPOTS.map((s) => [`${s.n}|${s.t}`, s]));

  const rows = L.map((v) => {
    const m = byKey[`${v.name}|${v.town}`] || {};
    return {
      id: v.id,
      name: v.name,
      category: v.cat || null,
      region: v.reg,
      region_name: m.rn || v.town,
      region_color: m.c || "#E8614D",
      town: v.town,
      address: v.addr || null,
      phone: v.ph || null,
      hh_start: v.hh?.s || null,
      hh_end: v.hh?.e || null,
      hh_days: JSON.stringify(v.hh?.d || []),
      deals: JSON.stringify(v.deals || []),
      vibe: v.vibe || null,
      lat: v.lat,
      lng: v.lng,
      featured: v.feat ? 1 : 0,
      collections: JSON.stringify(v.col || []),
      spot_path: m.s || null,
      status: "published"
    };
  });

  const outDir = path.join(root, "scripts", "generated");
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "venues-seed.json");
  fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2));

  const statements = [
    "DELETE FROM venues;",
    ...rows.map((r) => {
      return (
        "INSERT INTO venues (id,name,category,region,region_name,region_color,town,address,phone,hh_start,hh_end,hh_days,deals,vibe,lat,lng,featured,collections,spot_path,status) VALUES (" +
        [
          r.id,
          sqlStr(r.name),
          sqlStr(r.category),
          sqlStr(r.region),
          sqlStr(r.region_name),
          sqlStr(r.region_color),
          sqlStr(r.town),
          sqlStr(r.address),
          sqlStr(r.phone),
          sqlStr(r.hh_start),
          sqlStr(r.hh_end),
          sqlStr(r.hh_days),
          sqlStr(r.deals),
          sqlStr(r.vibe),
          r.lat == null ? "NULL" : Number(r.lat),
          r.lng == null ? "NULL" : Number(r.lng),
          r.featured,
          sqlStr(r.collections),
          sqlStr(r.spot_path),
          sqlStr(r.status)
        ].join(",") +
        ");"
      );
    })
  ];

  const sqlPath = path.join(outDir, "venues-seed.sql");
  fs.writeFileSync(sqlPath, statements.join("\n") + "\n");
  console.log(`Wrote ${rows.length} venues → ${sqlPath}`);

  function apply(flag) {
    const res = spawnSync(
      "npx",
      ["wrangler", "d1", "execute", "michiganhappyhour", flag, "--file", sqlPath],
      { cwd: root, stdio: "inherit", shell: process.platform === "win32" }
    );
    if (res.status !== 0) process.exit(res.status || 1);
  }

  if (applyLocal) apply("--local");
  if (applyRemote) apply("--remote");
  if (!applyLocal && !applyRemote) {
    console.log("Dry run only. Re-run with --apply-local and/or --apply-remote to insert.");
  }
}

main();
