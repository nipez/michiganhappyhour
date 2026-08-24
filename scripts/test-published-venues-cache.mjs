/**
 * Local smoke test for published-venues cache (no wrangler required).
 * Run: node --input-type=module scripts/test-published-venues-cache.mjs
 */
import {
  getPublishedVenues,
  invalidatePublishedVenuesCache,
  regionCountsFromVenues,
  PUBLISHED_VENUES_TTL_SECONDS
} from "../functions/lib/published-venues-cache.js";

const sample = [
  {
    id: 1,
    name: "Alpha Bar",
    region: "detroit",
    town: "Detroit",
    address: "1 Main",
    hh_start: "3pm",
    hh_end: "6pm",
    featured: 1,
    status: "published"
  },
  {
    id: 2,
    name: "Beta Pub",
    region: "holland",
    town: "Holland",
    address: "2 Main",
    hh_start: "4pm",
    hh_end: "7pm",
    featured: 0,
    status: "published"
  }
];

const store = new Map();
globalThis.caches = {
  default: {
    async match(req) {
      const key = typeof req === "string" ? req : req.url;
      const hit = store.get(key);
      return hit ? hit.clone() : undefined;
    },
    async put(req, res) {
      const key = typeof req === "string" ? req : req.url;
      store.set(key, res.clone());
    },
    async delete(req) {
      const key = typeof req === "string" ? req : req.url;
      return store.delete(key);
    }
  }
};

let prepareCalls = 0;
const env = {
  DB: {
    prepare() {
      return {
        async all() {
          prepareCalls += 1;
          return { results: sample };
        }
      };
    }
  }
};

const ctx = { data: {}, waitUntil() {} };

const a = await getPublishedVenues(env, ctx);
const b = await getPublishedVenues(env, ctx);
if (a.length !== 2 || b.length !== 2) throw new Error("unexpected length");
if (prepareCalls !== 1) throw new Error(`expected 1 D1 hit, got ${prepareCalls}`);
if (a !== b) throw new Error("request memo should return same array");

const ctx2 = { data: {}, waitUntil() {} };
const c = await getPublishedVenues(env, ctx2);
if (prepareCalls !== 1) throw new Error(`cache hit should skip D1, got ${prepareCalls}`);
if (c[0].name !== "Alpha Bar") throw new Error("cache payload mismatch");

await invalidatePublishedVenuesCache(ctx2);
const ctx3 = { data: {}, waitUntil() {} };
await getPublishedVenues(env, ctx3);
if (prepareCalls !== 2) throw new Error(`expected refill after invalidate, got ${prepareCalls}`);

const counts = regionCountsFromVenues(sample);
if (counts.detroit !== 1 || counts.holland !== 1) throw new Error("region counts");
if (PUBLISHED_VENUES_TTL_SECONDS < 60) throw new Error("ttl too short");

console.log("published-venues-cache smoke passed");
