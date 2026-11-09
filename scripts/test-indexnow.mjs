#!/usr/bin/env node
/**
 * Minimal unit checks for IndexNow change detection helpers.
 * Run: node scripts/test-indexnow.mjs
 *
 * Also exercises dry-run of the submit script against the real sitemap
 * (no network POST).
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const KEY = "5a011e7451e43a4c03bacd51c0ba3ed1";
const keyFile = path.join(root, `${KEY}.txt`);
assert(fs.existsSync(keyFile), `missing key file ${KEY}.txt`);
assert(
  fs.readFileSync(keyFile, "utf8").trim() === KEY,
  "key file body must equal the key"
);
assert(/^[a-f0-9]{32}$/.test(KEY), "key must be 32 hex chars");

const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
assert(sitemap.includes("<urlset"), "sitemap present");
assert(sitemap.includes("https://michiganhappyhour.com/"), "sitemap has home URL");

// lastmod must be captured from single-line <url> entries (not dropped).
{
  const monday = sitemap
    .split(/<\/url>/i)
    .find((c) => c.includes("/blog/monday-happy-hour-michigan"));
  assert(monday, "monday blog in sitemap");
  const lastmod = monday.match(/<lastmod>\s*([^<\s]*)\s*<\/lastmod>/i)?.[1];
  assert(lastmod && /^\d{4}-\d{2}-\d{2}$/.test(lastmod), `monday lastmod: ${lastmod}`);
}

// Dry-run with an explicit URL — must print payload and exit 0 (no network).
const dry = spawnSync(
  process.execPath,
  [
    path.join(root, "scripts/indexnow-submit.mjs"),
    "https://michiganhappyhour.com/blog/monday-happy-hour-michigan"
  ],
  {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, INDEXNOW_DRY_RUN: "1" }
  }
);
assert(dry.status === 0, `dry-run exit ${dry.status}: ${dry.stderr}`);
assert(dry.stdout.includes("DRY RUN payload"), "prints dry-run payload");
assert(dry.stdout.includes('"host": "michiganhappyhour.com"'), "payload host");
assert(dry.stdout.includes(`"key": "${KEY}"`), "payload key");
assert(
  dry.stdout.includes(`"keyLocation": "https://michiganhappyhour.com/${KEY}.txt"`),
  "payload keyLocation"
);
assert(
  dry.stdout.includes("https://michiganhappyhour.com/blog/monday-happy-hour-michigan"),
  "payload includes URL"
);

// Auto mode dry-run should also succeed (may submit 0 or many).
const auto = spawnSync(
  process.execPath,
  [path.join(root, "scripts/indexnow-submit.mjs")],
  {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, INDEXNOW_DRY_RUN: "1" }
  }
);
assert(auto.status === 0, `auto dry-run exit ${auto.status}: ${auto.stderr}`);
assert(
  auto.stdout.includes("[indexnow]") &&
    (auto.stdout.includes("Nothing to submit") || auto.stdout.includes("DRY RUN payload")),
  `auto dry-run output unexpected:\n${auto.stdout}`
);

console.log("test-indexnow: ok");
