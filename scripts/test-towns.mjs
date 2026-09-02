/**
 * Local smoke test for town gating helpers (no wrangler required).
 * Run: node --input-type=module scripts/test-towns.mjs
 */
import {
  findQualifyingTown,
  getQualifyingTowns,
  groupVenuesByTown,
  hasHappyHourHours,
  MIN_TOWN_HOURS,
  townSlug
} from "../functions/lib/towns.js";
import { renderTownPage } from "../functions/lib/render-town-page.js";

const venues = [
  {
    id: 1,
    name: "Alpha",
    town: "Royal Oak",
    region: "detroit",
    region_name: "Detroit",
    hh_start: "3:00 PM",
    hh_end: "6:00 PM",
    deals: '["$5 drafts"]',
    spot_path: "../spots/alpha-royal-oak.html"
  },
  {
    id: 2,
    name: "Beta",
    town: "Royal Oak",
    region: "detroit",
    region_name: "Detroit",
    hh_start: "4:00 PM",
    hh_end: "7:00 PM",
    deals: '["$6 cocktails"]',
    spot_path: "../spots/beta-royal-oak.html"
  },
  {
    id: 3,
    name: "Shell Pub",
    town: "Ferndale",
    region: "detroit",
    region_name: "Detroit",
    hh_start: null,
    hh_end: null,
    deals: "[]",
    spot_path: "../spots/shell-pub-ferndale.html"
  },
  {
    id: 4,
    name: "Solo Bar",
    town: "Beulah",
    region: "frankfort-benzie",
    region_name: "Frankfort & Benzie",
    hh_start: "3:00 PM",
    hh_end: "5:00 PM",
    deals: '["$4 wells"]',
    spot_path: "../spots/solo-bar-beulah.html"
  },
  {
    id: 5,
    name: "Locks A",
    town: "Sault Ste Marie",
    region: "up-east",
    region_name: "Eastern UP",
    hh_start: "3:00 PM",
    hh_end: "6:00 PM",
    deals: "[]",
    spot_path: "../spots/locks-a-sault-ste-marie.html"
  },
  {
    id: 6,
    name: "Locks B",
    town: "Sault Ste. Marie",
    region: "up-east",
    region_name: "Eastern UP",
    hh_start: "4:00 PM",
    hh_end: "7:00 PM",
    deals: "[]",
    spot_path: "../spots/locks-b-sault-ste-marie.html"
  }
];

if (MIN_TOWN_HOURS !== 2) throw new Error("expected gate of 2");
if (!hasHappyHourHours(venues[0])) throw new Error("hours detect");
if (hasHappyHourHours(venues[2])) throw new Error("shell should lack hours");
if (townSlug("Royal Oak") !== "royal-oak") throw new Error("slug");

const grouped = groupVenuesByTown(venues);
if (!grouped.has("royal-oak")) throw new Error("missing royal oak");
if (!grouped.has("sault-ste-marie")) throw new Error("slug merge failed");
if (grouped.get("sault-ste-marie").withHours.length !== 2) {
  throw new Error("merged hours count");
}

const qualifying = getQualifyingTowns(venues);
const slugs = qualifying.map((t) => t.slug).sort();
if (JSON.stringify(slugs) !== JSON.stringify(["royal-oak", "sault-ste-marie"])) {
  throw new Error(`unexpected qualifying set: ${slugs.join(",")}`);
}
if (findQualifyingTown(venues, "ferndale")) throw new Error("ferndale must 404");
if (findQualifyingTown(venues, "beulah")) throw new Error("single-hours town must 404");
if (!findQualifyingTown(venues, "royal-oak")) throw new Error("royal oak should qualify");

const page = renderTownPage(findQualifyingTown(venues, "royal-oak"), qualifying);
if (!page || !page.includes("Happy Hour in Royal Oak, Michigan")) {
  throw new Error("render missing H1");
}
if (!page.includes("application/ld+json")) throw new Error("missing JSON-LD");
if (!page.includes("/spots/alpha-royal-oak")) throw new Error("missing spot link");
if (!page.includes("/regions/detroit")) throw new Error("missing region link");

console.log("towns helpers smoke passed");
