#!/usr/bin/env node
/**
 * Archive duplicate published venues that share the same spot_path.
 * Keeps curated / hours-verified rows when possible.
 *
 *   node scripts/fix-duplicate-spots.mjs --apply-remote
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function d1Json(command, remote = true) {
  const flag = remote ? "--remote" : "--local";
  const res = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", "michiganhappyhour", flag, "--json", "--command", command],
    { cwd: root, encoding: "utf8", shell: process.platform === "win32" }
  );
  if (res.status !== 0) throw new Error(res.stderr || res.stdout);
  return JSON.parse(res.stdout)[0]?.results || [];
}

function main() {
  const apply = process.argv.includes("--apply-remote") || process.argv.includes("--apply-local");
  const remote = !process.argv.includes("--apply-local");
  const rows = d1Json(
    `SELECT id, name, town, spot_path, source, hh_start FROM venues
     WHERE status='published'
       AND spot_path IN (
         SELECT spot_path FROM venues WHERE status='published'
         GROUP BY spot_path HAVING COUNT(*) > 1
       )
     ORDER BY spot_path, id`,
    true
  );
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.spot_path)) groups.set(r.spot_path, []);
    groups.get(r.spot_path).push(r);
  }
  const archiveIds = [];
  for (const items of groups.values()) {
    const ranked = [...items].sort((a, b) => {
      const ac = (a.source || "curated") !== "osm" ? 0 : 1;
      const bc = (b.source || "curated") !== "osm" ? 0 : 1;
      if (ac !== bc) return ac - bc;
      const ah = a.hh_start ? 0 : 1;
      const bh = b.hh_start ? 0 : 1;
      if (ah !== bh) return ah - bh;
      return a.id - b.id;
    });
    archiveIds.push(...ranked.slice(1).map((r) => r.id));
  }
  console.log(`${groups.size} duplicate groups; would archive ${archiveIds.length} rows`);
  if (!archiveIds.length) return;
  const sql = archiveIds
    .map(
      (id) =>
        `UPDATE venues SET status='archived', admin_notes=TRIM(COALESCE(admin_notes,'') || ' | archived duplicate of spot_path'), updated_at=datetime('now') WHERE id=${id};`
    )
    .join("\n");
  const sqlPath = path.join(root, "scripts", "generated", "archive-dup-spots.sql");
  fs.mkdirSync(path.dirname(sqlPath), { recursive: true });
  fs.writeFileSync(sqlPath, sql + "\n");
  console.log("Wrote", sqlPath);
  if (!apply) {
    console.log("Dry run. Re-run with --apply-remote to archive.");
    return;
  }
  const flag = remote ? "--remote" : "--local";
  const res = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", "michiganhappyhour", flag, "--file", sqlPath],
    { cwd: root, stdio: "inherit", shell: process.platform === "win32" }
  );
  process.exit(res.status || 0);
}

main();
