/**
 * Markup for the exclusive local sponsor slot on town/region pages.
 * No third-party ad scripts — first-party HTML + existing CTA tracker.
 */

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

/**
 * CSS shared by town/region pages for the sponsor slot.
 */
export const SPONSOR_SLOT_CSS = `
.mhh-sponsor{display:flex;align-items:center;gap:14px;margin:0 0 22px;padding:12px 14px;border:1px solid #D8E2EA;border-radius:12px;background:#fff;text-decoration:none;color:inherit;max-width:520px}
.mhh-sponsor:hover{border-color:#E8614D}
.mhh-sponsor-label{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8AA3B5;margin-bottom:2px}
.mhh-sponsor-name{font-size:16px;font-weight:700;color:#1B2838;line-height:1.25}
.mhh-sponsor-tag{font-size:14px;color:#4A6274;margin-top:2px;line-height:1.4}
.mhh-sponsor-logo{width:48px;height:48px;border-radius:10px;object-fit:contain;background:#F5F7FA;flex-shrink:0}
.mhh-sponsor-cta{margin:0 0 18px;font-size:13px;color:#8AA3B5}
.mhh-sponsor-cta a{color:#6B8A9E;text-decoration:underline;text-underline-offset:2px;font-weight:500}
.mhh-sponsor-cta a:hover{color:#E8614D}
`;

/**
 * Render the sponsored-by card, or a quiet sell link when none is live.
 * @param {object|null} sponsor
 * @param {{ placeType: 'town'|'region', placeSlug: string, placeLabel: string }} ctx
 */
export function renderSponsorSlot(sponsor, ctx) {
  const placeType = ctx?.placeType || "town";
  const placeSlug = ctx?.placeSlug || "";
  const placeLabel = ctx?.placeLabel || "this area";
  const sellHref = `/sponsor/?${new URLSearchParams({
    type: placeType,
    slug: placeSlug,
    name: placeLabel
  }).toString()}`;

  if (!sponsor) {
    const label =
      placeType === "region"
        ? `Sponsor this region, $100/mo`
        : `Sponsor this town, $100/mo`;
    return (
      `<p class="mhh-sponsor-cta">` +
      `<a href="${escapeAttr(sellHref)}">${escapeHtml(label)}</a>` +
      `</p>`
    );
  }

  const href = String(sponsor.url || "").trim() || "#";
  const name = String(sponsor.name || "").trim() || "Sponsor";
  const tagline = String(sponsor.tagline || "").trim();
  const imageUrl = String(sponsor.image_url || "").trim();
  const id = sponsor.id != null ? String(sponsor.id) : "";

  const logo = imageUrl
    ? `<img class="mhh-sponsor-logo" src="${escapeAttr(imageUrl)}" alt="" width="48" height="48" loading="lazy" decoding="async">`
    : "";

  return (
    `<a class="mhh-sponsor" href="${escapeAttr(href)}" rel="sponsored nofollow" target="_blank" ` +
    `data-sponsor-id="${escapeAttr(id)}" data-sponsor-name="${escapeAttr(name)}" ` +
    `data-place-type="${escapeAttr(placeType)}" data-place-slug="${escapeAttr(placeSlug)}">` +
    logo +
    `<span style="min-width:0">` +
    `<div class="mhh-sponsor-label">Sponsored by</div>` +
    `<div class="mhh-sponsor-name">${escapeHtml(name)}</div>` +
    (tagline ? `<div class="mhh-sponsor-tag">${escapeHtml(tagline)}</div>` : "") +
    `</span></a>`
  );
}
