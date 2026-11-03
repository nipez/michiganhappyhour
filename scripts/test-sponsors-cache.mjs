/**
 * Local smoke test for sponsors cache + date window.
 * Run: node --input-type=module scripts/test-sponsors-cache.mjs
 */
import {
  getSponsors,
  getActiveSponsor,
  invalidateSponsorsCache,
  isSponsorLive,
  SPONSORS_TTL_SECONDS
} from "../functions/lib/sponsors-cache.js";
import { renderSponsorSlot } from "../functions/lib/render-sponsor.js";

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

const sample = [
  {
    id: 1,
    place_type: "town",
    place_slug: "royal-oak",
    name: "Live Brewery",
    url: "https://example.com/live",
    tagline: "Pints nearby",
    image_url: "",
    starts_at: yesterday,
    ends_at: nextMonth,
    active: 1
  },
  {
    id: 2,
    place_type: "town",
    place_slug: "royal-oak",
    name: "Expired Cafe",
    url: "https://example.com/old",
    tagline: "Gone",
    image_url: null,
    starts_at: "2020-01-01",
    ends_at: yesterday,
    // ends_at yesterday: if today > yesterday, not live. isSponsorLive uses day <= end,
    // so yesterday is still live today? Wait: day <= end means yesterday <= today for end=yesterday
    // Actually ends_at = yesterday means still live ON yesterday, not today if today > yesterday.
    // today > yesterday so NOT live. Good — but wait ends_at yesterday: day <= end → today <= yesterday? false. Good.
    active: 1
  },
  {
    id: 3,
    place_type: "region",
    place_slug: "detroit",
    name: "Inactive Co",
    url: "https://example.com/x",
    tagline: "",
    image_url: null,
    starts_at: yesterday,
    ends_at: nextMonth,
    active: 0
  }
];

if (!isSponsorLive(sample[0], today)) throw new Error("live sponsor should be live");
if (isSponsorLive(sample[1], today)) throw new Error("expired sponsor should not be live");
if (isSponsorLive(sample[2], today)) throw new Error("inactive sponsor should not be live");

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
const a = await getSponsors(env, ctx);
const b = await getSponsors(env, ctx);
if (a.length !== 3) throw new Error("unexpected length");
if (prepareCalls !== 1) throw new Error(`expected 1 D1 hit, got ${prepareCalls}`);
if (a !== b) throw new Error("request memo should return same array");

const live = await getActiveSponsor(env, "town", "royal-oak", ctx);
if (!live || live.name !== "Live Brewery") throw new Error("expected Live Brewery");

const none = await getActiveSponsor(env, "town", "holland", ctx);
if (none) throw new Error("holland should have no sponsor");

const expiredOnly = await getActiveSponsor(env, "town", "royal-oak", {
  data: {},
  waitUntil() {}
});
// still Live Brewery from cache
if (!expiredOnly || expiredOnly.id !== 1) throw new Error("cache should still return live");

await invalidateSponsorsCache(ctx);
if (SPONSORS_TTL_SECONDS !== 300) throw new Error("TTL should be 300");

const html = renderSponsorSlot(live, {
  placeType: "town",
  placeSlug: "royal-oak",
  placeLabel: "Royal Oak"
});
if (!/Sponsored by/.test(html) || !/rel="sponsored nofollow"/.test(html)) {
  throw new Error("sponsor card markup missing");
}
const sell = renderSponsorSlot(null, {
  placeType: "town",
  placeSlug: "holland",
  placeLabel: "Holland"
});
if (!/Sponsor this town, \$100\/mo/.test(sell) || !/\/sponsor\//.test(sell)) {
  throw new Error("sell link markup missing");
}

console.log("ok sponsors-cache", { today, tomorrow, prepareCalls });
