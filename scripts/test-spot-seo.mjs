/**
 * Smoke test for name-intent spot SEO titles/descriptions.
 * Run: node --input-type=module scripts/test-spot-seo.mjs
 *   or: npm run test:spot-seo
 */
import { buildSpotSeo } from "../functions/lib/render-spot-page.js";
import { buildHomeSeo } from "../functions/lib/home-seo.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const prost = buildSpotSeo(
  "Prost Wine Bar & Charcuterie",
  "Bay City",
  "4:00 PM",
  "6:00 PM",
  ["$3 off wine flights", "$5 featured wines", "Charcuterie board specials"],
  "Wine Bar",
  "prost-wine-bar-charcuterie-bay-city",
  ["Tuesday", "Wednesday", "Thursday", "Friday"]
);
assert(prost.title.includes("Prost"), `Prost name: ${prost.title}`);
assert(prost.title.includes("Bay City") || prost.title.includes("4"), `Prost city/hours: ${prost.title}`);
assert(/Tue-Fri|4pm|Times & Deals/.test(prost.title), `Prost schedule or template: ${prost.title}`);
assert(prost.desc.toLowerCase().includes("prost") && prost.desc.includes("Bay City"), `Prost desc: ${prost.desc}`);
assert(prost.title.length <= 60, `Prost title length ${prost.title.length}`);
assert(prost.desc.length <= 155, `Prost desc length ${prost.desc.length}`);

const hopcat = buildSpotSeo(
  "HopCat Detroit",
  "Detroit",
  "3:00 PM",
  "5:30 PM",
  ["50% off select apps", "$4 draft beers", "$6 specialty drinks"],
  "Restaurant",
  "hopcat-detroit-detroit",
  ["Monday", "Tuesday", "Wednesday", "Thursday"]
);
assert(hopcat.title.startsWith("HopCat Detroit Happy Hour"), `HopCat title: ${hopcat.title}`);
assert(!hopcat.title.includes("Detroit Detroit"), `HopCat no double city: ${hopcat.title}`);
assert(/Mon-Thu|3pm|Times & Deals/.test(hopcat.title), `HopCat schedule: ${hopcat.title}`);
assert(hopcat.desc.includes("$4 draft") || hopcat.desc.includes("50% off"), `HopCat deals in meta: ${hopcat.desc}`);

const rapid = buildSpotSeo(
  "Rapid City Tavern",
  "Rapid City",
  "",
  "",
  ["Ask about today's drink & food specials"],
  "Cocktail Bar",
  "rapid-city-tavern-rapid-city",
  ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
);
assert(rapid.title.includes("Rapid City Tavern"), `Rapid title: ${rapid.title}`);
assert(rapid.title.includes("Times & Deals") || rapid.title.includes("Happy Hour"), `Rapid template: ${rapid.title}`);
assert(!rapid.desc.toLowerCase().includes("ask about today"), `Rapid no placeholder deal in meta: ${rapid.desc}`);
assert(/vary|confirm|location/i.test(rapid.desc), `Rapid graceful fallback: ${rapid.desc}`);

const bar46 = buildSpotSeo(
  "46 Bar",
  "Muskegon",
  "3:00 PM",
  "6:00 PM",
  ["$1 off all drinks", "Discounted appetizers"],
  "Bar",
  "46-bar-muskegon",
  ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
);
assert(bar46.title.includes("46 Bar"), `46 Bar title: ${bar46.title}`);
assert(bar46.title.includes("Muskegon") || /Mon-Fri|3pm/.test(bar46.title), `46 Bar city/hours: ${bar46.title}`);

const unicorn = buildSpotSeo(
  "Unicorn Lounge",
  "Lansing",
  "",
  "",
  [],
  "Cocktail Bar",
  "unicorn-lounge-lansing",
  []
);
assert(unicorn.title.includes("Unicorn Bar"), `Unicorn title: ${unicorn.title}`);
assert(unicorn.desc.includes("Unicorn Bar") && unicorn.desc.includes("Lansing"), `Unicorn desc: ${unicorn.desc}`);

const home = buildHomeSeo(1270);
assert(home.title.length <= 60, `Home title length ${home.title.length}`);
assert(home.desc.length <= 155, `Home desc length ${home.desc.length}`);
assert(/near me/i.test(home.title), `Home near-me: ${home.title}`);
assert(home.title.includes("1,270") || home.desc.includes("1,270"), `Home count: ${home.title} / ${home.desc}`);
assert(/Detroit|Grand Rapids|Traverse City/i.test(home.desc), `Home cities: ${home.desc}`);

console.log("OK spot + home SEO");
console.log("  Prost :", prost.title);
console.log("  HopCat:", hopcat.title);
console.log("  Rapid :", rapid.title);
console.log("  46 Bar:", bar46.title);
console.log("  Unicorn:", unicorn.title);
console.log("  Home  :", home.title);
console.log("  Home meta:", home.desc);
