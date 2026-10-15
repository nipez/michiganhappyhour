/**
 * Smoke test for name-intent spot SEO titles/descriptions.
 * Run: node --input-type=module scripts/test-spot-seo.mjs
 */
import { buildSpotSeo } from "../functions/lib/render-spot-page.js";

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
  "prost-wine-bar-charcuterie-bay-city"
);
assert(prost.title.startsWith("Prost Bay City Happy Hour"), `Prost title lead: ${prost.title}`);
assert(prost.title.includes("4:00 PM"), `Prost hours in title: ${prost.title}`);
assert(prost.desc.toLowerCase().includes("prost") && prost.desc.includes("Bay City"), `Prost desc: ${prost.desc}`);
assert(prost.title.length <= 60, `Prost title length ${prost.title.length}`);

const hopcat = buildSpotSeo(
  "HopCat Detroit",
  "Detroit",
  "3:00 PM",
  "5:30 PM",
  ["50% off select apps", "$4 draft beers", "$6 specialty drinks"],
  "Restaurant",
  "hopcat-detroit-detroit"
);
assert(hopcat.title.startsWith("HopCat Detroit Happy Hour"), `HopCat title: ${hopcat.title}`);
assert(!hopcat.title.includes("Detroit Detroit"), `HopCat no double city: ${hopcat.title}`);
assert(hopcat.title.includes("3:00 PM"), `HopCat hours: ${hopcat.title}`);

const bar46 = buildSpotSeo(
  "46 Bar",
  "Muskegon",
  "3:00 PM",
  "6:00 PM",
  ["$1 off all drinks", "Discounted appetizers"],
  "Bar",
  "46-bar-muskegon"
);
assert(bar46.title.startsWith("46 Bar Muskegon Happy Hour"), `46 Bar title: ${bar46.title}`);

const unicorn = buildSpotSeo(
  "Unicorn Lounge",
  "Lansing",
  "",
  "",
  [],
  "Cocktail Bar",
  "unicorn-lounge-lansing"
);
assert(unicorn.title === "Unicorn Bar Lansing Happy Hour", `Unicorn title: ${unicorn.title}`);
assert(unicorn.desc.includes("Unicorn Bar") && unicorn.desc.includes("Lansing"), `Unicorn desc: ${unicorn.desc}`);

const dixie = buildSpotSeo(
  "The Dixie Saloon",
  "Mackinaw City",
  "3:00 PM",
  "6:00 PM",
  ["$4 wells", "$5 burgers"],
  "Bar",
  "the-dixie-saloon-mackinaw-city"
);
assert(dixie.title.startsWith("The Dixie Saloon Mackinaw City Happy Hour"), `Dixie title: ${dixie.title}`);

console.log("OK spot SEO");
console.log("  Prost :", prost.title);
console.log("  HopCat:", hopcat.title);
console.log("  46 Bar:", bar46.title);
console.log("  Unicorn:", unicorn.title);
console.log("  Dixie :", dixie.title);
