/** Shared venue row helpers for public + admin APIs. */

const DAY_ABBR = {
  Sunday: "Sun",
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat"
};

const COL_BADGES = {
  late: '<span style="background:#F5F3FF;color:#7C3AED;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600">Late Night</span>',
  patio: '<span style="background:#ECFDF5;color:#059669;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600">Patio</span>',
  waterfront: '<span style="background:#EFF6FF;color:#2563EB;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600">Waterfront</span>',
  oysters: '<span style="background:#FFF7ED;color:#C2410C;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600">Oysters</span>'
};

export function parseJsonArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw == null || raw === "") return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function abbreviateDays(days) {
  const d = parseJsonArray(days);
  if (!d.length) return "";
  if (d.length === 7) return "Every day";
  const abbr = d.map((x) => DAY_ABBR[x] || String(x).slice(0, 3));
  if (abbr.length === 1) return abbr[0];
  // Compact Mon-Fri style when contiguous weekdays
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const idxs = abbr.map((a) => order.indexOf(a)).filter((i) => i >= 0).sort((a, b) => a - b);
  if (idxs.length === abbr.length && idxs[idxs.length - 1] - idxs[0] === idxs.length - 1) {
    return `${order[idxs[0]]}-${order[idxs[idxs.length - 1]]}`;
  }
  return abbr.join(", ");
}

export function dealsHtml(deals) {
  return parseJsonArray(deals)
    .map(
      (d) =>
        `<div style="font-size:13px;color:#1B2838;margin-top:3px;padding-left:14px;text-indent:-14px">&#8594; ${escapeHtml(d)}</div>`
    )
    .join("");
}

export function collectionBadges(collections) {
  return parseJsonArray(collections)
    .map((c) => COL_BADGES[c] || "")
    .filter(Boolean)
    .join("");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Homepage / listing card shape (matches legacy `const L` objects). */
export function toListVenue(row) {
  const out = {
    id: row.id,
    name: row.name,
    cat: row.category || "",
    reg: row.region,
    town: row.town,
    addr: row.address || "",
    hh: {
      s: row.hh_start || "",
      e: row.hh_end || "",
      d: parseJsonArray(row.hh_days)
    },
    deals: parseJsonArray(row.deals),
    vibe: row.vibe || "",
    ph: row.phone || "",
    web: row.website || "",
    oh: row.opening_hours || "",
    lat: row.lat,
    lng: row.lng
  };
  if (row.featured) out.feat = true;
  const col = parseJsonArray(row.collections);
  if (col.length) out.col = col;
  return out;
}

/** Public spot URL from DB spot_path (extensionless). */
export function publicSpotHref(spotPath) {
  if (!spotPath) return "#";
  const raw = String(spotPath).trim();
  if (raw === "#" || raw.startsWith("http")) return raw;
  const base = raw.split("/").pop() || "";
  const slug = base.endsWith(".html") ? base.slice(0, -5) : base;
  if (!slug) return "#";
  return `/spots/${slug}`;
}

/** Compact map marker shape (matches legacy `SPOTS` objects). */
export function toMapVenue(row) {
  return {
    n: row.name,
    lat: row.lat,
    lng: row.lng,
    t: row.town,
    r: row.region,
    rn: row.region_name || row.town,
    c: row.region_color || "#E8614D",
    cat: row.category || "",
    hs: row.hh_start || "",
    he: row.hh_end || "",
    dy: abbreviateDays(row.hh_days),
    dl: dealsHtml(row.deals),
    cb: collectionBadges(row.collections),
    v: row.vibe || "",
    s: publicSpotHref(row.spot_path),
    f: row.featured ? 1 : 0
  };
}

/** Admin / full row shape. */
export function toFullVenue(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    region: row.region,
    region_name: row.region_name,
    region_color: row.region_color,
    town: row.town,
    address: row.address,
    phone: row.phone,
    website: row.website || null,
    opening_hours: row.opening_hours || null,
    hh_start: row.hh_start,
    hh_end: row.hh_end,
    hh_days: parseJsonArray(row.hh_days),
    deals: parseJsonArray(row.deals),
    vibe: row.vibe,
    lat: row.lat,
    lng: row.lng,
    featured: !!row.featured,
    collections: parseJsonArray(row.collections),
    spot_path: row.spot_path,
    status: row.status,
    source: row.source || "curated",
    external_id: row.external_id || null,
    last_verified_at: row.last_verified_at || null,
    admin_notes: row.admin_notes,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export function slugify(name, town) {
  return `${name}-${town}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
