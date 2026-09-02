/**
 * Town landing helpers — group published venues by town slug and gate
 * thin/OSM-only towns (no happy-hour hours) out of public URLs.
 */

/** Minimum venues with both hh_start and hh_end required for a public town page. */
export const MIN_TOWN_HOURS = 2;

/** True when a venue has a usable happy-hour window. */
export function hasHappyHourHours(venue) {
  const start = String(venue?.hh_start || "").trim();
  const end = String(venue?.hh_end || "").trim();
  return Boolean(start && end);
}

/** Normalize a town display name into a URL slug. */
export function townSlug(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeTownSlug(raw) {
  let s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  s = s.split("/").filter(Boolean).pop() || s;
  if (s.endsWith(".html")) s = s.slice(0, -5);
  return townSlug(s);
}

export function canonicalTownPath(slugOrName) {
  const slug = townSlug(slugOrName);
  return slug ? `/towns/${slug}` : "/";
}

/**
 * Group published venues by town slug (case / punctuation variants merge).
 * @returns {Map<string, { slug: string, name: string, region: string, region_name: string, venues: object[], withHours: object[] }>}
 */
export function groupVenuesByTown(venues) {
  const map = new Map();
  for (const v of venues || []) {
    const name = String(v?.town || "").trim();
    if (!name) continue;
    const slug = townSlug(name);
    if (!slug) continue;

    let entry = map.get(slug);
    if (!entry) {
      entry = {
        slug,
        name,
        region: v.region || "",
        region_name: v.region_name || "",
        venues: [],
        withHours: []
      };
      map.set(slug, entry);
    }

    entry.venues.push(v);
    if (hasHappyHourHours(v)) entry.withHours.push(v);

    // Prefer the display name / region from a hours venue when available.
    if (hasHappyHourHours(v)) {
      entry.name = name;
      if (v.region) entry.region = v.region;
      if (v.region_name) entry.region_name = v.region_name;
    } else if (name.length > entry.name.length) {
      // Prefer "Sault Ste. Marie" over "Sault Ste Marie" when no hours yet.
      entry.name = name;
    }
  }

  // Resolve parent region by majority among hours venues (fallback: all).
  for (const entry of map.values()) {
    const pool = entry.withHours.length ? entry.withHours : entry.venues;
    const counts = {};
    for (const v of pool) {
      if (!v.region) continue;
      counts[v.region] = (counts[v.region] || 0) + 1;
    }
    let best = entry.region;
    let bestN = 0;
    for (const [region, n] of Object.entries(counts)) {
      if (n > bestN) {
        best = region;
        bestN = n;
      }
    }
    entry.region = best || entry.region;
    const regionSample = pool.find((v) => v.region === entry.region);
    if (regionSample?.region_name) entry.region_name = regionSample.region_name;
  }

  return map;
}

/** Towns that meet the public-page hours gate, sorted by hours count then name. */
export function getQualifyingTowns(venues, minHours = MIN_TOWN_HOURS) {
  const map = groupVenuesByTown(venues);
  return [...map.values()]
    .filter((t) => t.withHours.length >= minHours)
    .sort(
      (a, b) =>
        b.withHours.length - a.withHours.length ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
}

/** Look up a qualifying town by slug, or null if missing / below the gate. */
export function findQualifyingTown(venues, slug, minHours = MIN_TOWN_HOURS) {
  const key = normalizeTownSlug(slug);
  if (!key) return null;
  const map = groupVenuesByTown(venues);
  const entry = map.get(key);
  if (!entry || entry.withHours.length < minHours) return null;
  return entry;
}
