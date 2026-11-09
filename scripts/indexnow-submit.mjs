#!/usr/bin/env node
/**
 * Submit changed (or explicit) URLs to IndexNow.
 *
 * Usage:
 *   npm run indexnow -- https://michiganhappyhour.com/blog/foo
 *   npm run indexnow                 # auto-detect changed URLs
 *   INDEXNOW_DRY_RUN=1 npm run indexnow
 *
 * Change detection (first match wins):
 *   1. Explicit URL args / INDEXNOW_URLS
 *   2. Compare current sitemap.xml to previous snapshot:
 *      - INDEXNOW_PREV_SHA / --prev=<sha>  (git show <sha>:sitemap.xml)
 *      - else scripts/generated/indexnow-state.json (url → lastmod)
 *      - else git HEAD~1:sitemap.xml when available
 *   3. Fallback: sitemap URLs whose <lastmod> is within the last 7 days
 *
 * Persists last-submitted url→lastmod to scripts/generated/indexnow-state.json
 * after a successful (non-dry-run) submit. No D1 / KV / secrets required.
 *
 * Non-2xx IndexNow responses are logged as warnings; process exits 0 so CI/build
 * is not failed by indexing flakiness.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const HOST = "michiganhappyhour.com";
const KEY = "5a011e7451e43a4c03bacd51c0ba3ed1";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = "https://api.indexnow.org/indexnow";
const SITEMAP_PATH = path.join(root, "sitemap.xml");
const STATE_PATH = path.join(root, "scripts/generated/indexnow-state.json");
const MAX_BATCH = 10_000;
const FALLBACK_DAYS = 7;

const dryRun =
  process.env.INDEXNOW_DRY_RUN === "1" ||
  process.argv.includes("--dry-run");

function parseArgs(argv) {
  const urls = [];
  let prev = process.env.INDEXNOW_PREV_SHA || "";
  for (const a of argv) {
    if (a === "--dry-run") continue;
    if (a.startsWith("--prev=")) {
      prev = a.slice("--prev=".length);
      continue;
    }
    if (a.startsWith("-")) continue;
    if (/^https?:\/\//i.test(a)) urls.push(a);
  }
  if (process.env.INDEXNOW_URLS) {
    for (const u of process.env.INDEXNOW_URLS.split(/[\s,]+/).filter(Boolean)) {
      urls.push(u);
    }
  }
  return { urls: [...new Set(urls)], prev };
}

function parseSitemap(xml) {
  /** @type {Map<string, string>} */
  const map = new Map();
  if (!xml) return map;
  // Prefer per-<url> chunks so <lastmod> is not skipped by an optional group.
  const chunks = xml.split(/<\/url>/i);
  for (const chunk of chunks) {
    const loc = chunk.match(/<loc>\s*([^<\s]+)\s*<\/loc>/i)?.[1]?.trim();
    if (!loc) continue;
    const lastmod = chunk.match(/<lastmod>\s*([^<\s]*)\s*<\/lastmod>/i)?.[1]?.trim() || "";
    map.set(loc, lastmod);
  }
  return map;
}

function readCurrentSitemap() {
  if (!fs.existsSync(SITEMAP_PATH)) {
    throw new Error(`Missing sitemap at ${SITEMAP_PATH}`);
  }
  return parseSitemap(fs.readFileSync(SITEMAP_PATH, "utf8"));
}

function gitShowSitemap(ref) {
  if (!ref) return null;
  // GitHub sends 40 zeros for github.event.before on a new branch.
  if (/^0+$/.test(ref)) return null;
  const res = spawnSync("git", ["show", `${ref}:sitemap.xml`], {
    cwd: root,
    encoding: "utf8"
  });
  if (res.status !== 0) {
    console.warn(
      `[indexnow] Could not read sitemap at ${ref}: ${(res.stderr || "").trim() || "git show failed"}`
    );
    return null;
  }
  return parseSitemap(res.stdout);
}

function loadStateFile() {
  if (!fs.existsSync(STATE_PATH)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    const map = new Map();
    const entries = raw?.urls && typeof raw.urls === "object" ? raw.urls : raw;
    for (const [url, lastmod] of Object.entries(entries || {})) {
      if (typeof url === "string" && url.startsWith("http")) {
        map.set(url, typeof lastmod === "string" ? lastmod : "");
      }
    }
    return map.size ? map : null;
  } catch (err) {
    console.warn(`[indexnow] Bad state file ${STATE_PATH}: ${err.message}`);
    return null;
  }
}

function saveStateFile(currentMap, submittedAt) {
  const urls = Object.fromEntries([...currentMap.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(
    STATE_PATH,
    `${JSON.stringify({ submittedAt, host: HOST, urls }, null, 2)}\n`
  );
  console.log(`[indexnow] Wrote state → ${path.relative(root, STATE_PATH)} (${currentMap.size} urls)`);
}

function diffSitemaps(current, previous) {
  const changed = [];
  for (const [url, lastmod] of current) {
    if (!previous.has(url) || previous.get(url) !== lastmod) {
      changed.push(url);
    }
  }
  return changed;
}

function recentByLastmod(current, days) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const out = [];
  for (const [url, lastmod] of current) {
    if (lastmod && lastmod >= cutoffStr) out.push(url);
  }
  return out;
}

function resolveUrlList(explicitUrls, prevSha) {
  if (explicitUrls.length) {
    return { urls: explicitUrls, method: "cli" };
  }

  const current = readCurrentSitemap();

  if (prevSha) {
    const previous = gitShowSitemap(prevSha);
    if (previous) {
      return {
        urls: diffSitemaps(current, previous),
        method: `git:${prevSha}`,
        current
      };
    }
  }

  const state = loadStateFile();
  if (state) {
    return {
      urls: diffSitemaps(current, state),
      method: "state-file",
      current
    };
  }

  const headPrev = gitShowSitemap("HEAD~1");
  if (headPrev) {
    return {
      urls: diffSitemaps(current, headPrev),
      method: "git:HEAD~1",
      current
    };
  }

  return {
    urls: recentByLastmod(current, FALLBACK_DAYS),
    method: `lastmod-${FALLBACK_DAYS}d`,
    current
  };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function postBatch(urlList) {
  const payload = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList
  };

  if (dryRun) {
    console.log("[indexnow] DRY RUN payload:");
    console.log(JSON.stringify(payload, null, 2));
    return { ok: true, status: 0, dryRun: true };
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload)
  });
  const text = (await res.text()).trim();
  const ok = res.status >= 200 && res.status < 300;
  console.log(
    `[indexnow] POST ${ENDPOINT} → HTTP ${res.status}${text ? ` ${text.slice(0, 200)}` : ""} (${urlList.length} urls)`
  );
  if (!ok) {
    console.warn(
      `[indexnow] Warning: non-2xx response (${res.status}); treating as non-fatal`
    );
  }
  return { ok, status: res.status };
}

async function main() {
  const { urls: explicit, prev } = parseArgs(process.argv.slice(2));
  const { urls, method, current } = resolveUrlList(explicit, prev);

  console.log(
    `[indexnow] keyLocation=${KEY_LOCATION} method=${method} candidates=${urls.length}${dryRun ? " dry-run" : ""}`
  );

  if (!urls.length) {
    console.log("[indexnow] Nothing to submit");
    if (!dryRun && current && method !== "cli") {
      // Keep state fresh even when no diffs so next run has a baseline.
      saveStateFile(current, new Date().toISOString());
    }
    return;
  }

  const batches = chunk(urls, MAX_BATCH);
  let anyOk = false;
  for (let i = 0; i < batches.length; i++) {
    console.log(`[indexnow] Batch ${i + 1}/${batches.length}: ${batches[i].length} urls`);
    const result = await postBatch(batches[i]);
    if (result.ok || result.dryRun) anyOk = true;
  }

  // Only persist baseline after auto-detected runs (not manual URL lists),
  // so a one-off `npm run indexnow -- <url>` cannot mark the whole sitemap submitted.
  if (!dryRun && anyOk && current && method !== "cli") {
    saveStateFile(current, new Date().toISOString());
  }
}

main().catch((err) => {
  console.warn(`[indexnow] Warning: ${err.message || err}`);
  // Never fail the build / CI for IndexNow problems.
  process.exit(0);
});
