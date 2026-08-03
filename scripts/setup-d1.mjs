#!/usr/bin/env node
/**
 * Creates the remote D1 database (if needed), patches wrangler.jsonc,
 * and applies migrations remotely.
 *
 * Usage:
 *   npx wrangler login
 *   npm run setup:d1
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const wranglerPath = path.join(root, "wrangler.jsonc");
const dbName = "michiganhappyhour";

function run(cmd) {
  console.log(`\n> ${cmd}`);
  return execSync(cmd, { encoding: "utf8", stdio: ["inherit", "pipe", "pipe"] });
}

function readWrangler() {
  return fs.readFileSync(wranglerPath, "utf8");
}

function currentDatabaseId(text) {
  const m = text.match(/"database_id"\s*:\s*"([^"]+)"/);
  return m ? m[1] : null;
}

function isPlaceholder(id) {
  return !id || id === "00000000-0000-4000-8000-000000000001" || id.includes("REPLACE");
}

let wranglerText = readWrangler();
let databaseId = currentDatabaseId(wranglerText);

if (isPlaceholder(databaseId)) {
  console.log(`Creating D1 database "${dbName}"...`);
  let out = "";
  try {
    out = run(`npx wrangler d1 create ${dbName}`);
  } catch (err) {
    const combined = `${err.stdout || ""}\n${err.stderr || ""}\n${err.message || ""}`;
    if (/already exists|A database with that name already exists/i.test(combined)) {
      console.log("Database already exists — fetching id via wrangler d1 list...");
      out = run("npx wrangler d1 list");
    } else {
      console.error(combined);
      console.error("\nMake sure you ran: npx wrangler login");
      process.exit(1);
    }
  }

  console.log(out);

  let match = out.match(/database_id\s*=\s*"?([0-9a-f-]{36})"?/i);
  if (!match) match = out.match(/"uuid"\s*:\s*"([0-9a-f-]{36})"/i);
  if (!match) {
    // wrangler d1 list table/json — find row for our db name
    const lines = out.split("\n");
    for (const line of lines) {
      if (line.includes(dbName)) {
        const ids = line.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        if (ids) {
          match = ids;
          break;
        }
      }
    }
  }

  if (!match) {
    console.error("Could not parse database_id from wrangler output. Paste it into wrangler.jsonc manually.");
    process.exit(1);
  }

  databaseId = match[1] || match[0];
  wranglerText = wranglerText.replace(
    /"database_id"\s*:\s*"[^"]+"/,
    `"database_id": "${databaseId}"`
  );
  fs.writeFileSync(wranglerPath, wranglerText);
  console.log(`Updated wrangler.jsonc database_id → ${databaseId}`);
} else {
  console.log(`Using existing database_id: ${databaseId}`);
}

console.log("\nApplying migrations locally...");
try {
  console.log(run(`npx wrangler d1 migrations apply ${dbName} --local`));
} catch (err) {
  console.error(err.stdout || err.stderr || err.message);
  process.exit(1);
}

console.log("\nApplying migrations remotely...");
try {
  console.log(run(`npx wrangler d1 migrations apply ${dbName} --remote`));
} catch (err) {
  console.error(err.stdout || err.stderr || err.message);
  process.exit(1);
}

console.log(`
Done.

Next:
1. Commit the updated wrangler.jsonc database_id if it changed
2. In Cloudflare Pages → Settings → Bindings, confirm DB → ${dbName}
   (Git deploys with wrangler.jsonc usually pick this up automatically)
3. Redeploy, then click around the site
4. Check: https://michiganhappyhour.com/api/stats
`);
