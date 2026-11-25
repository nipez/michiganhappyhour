/**
 * Homepage title + meta for "happy hour near me" CTR.
 * Count comes from getPublishedVenues() (cached) — never a separate D1 read.
 */

/**
 * @param {number} count published venue count
 * @returns {{ title: string, desc: string, ogTitle: string, countLabel: string }}
 */
export function buildHomeSeo(count) {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1270;
  const countLabel = n.toLocaleString("en-US");

  // Keep brand + near-me intent left of the pipe; count for specificity.
  let title = `Happy Hour Near Me in MI | ${countLabel} Spots`;
  if (title.length > 60) {
    title = `Happy Hour Near Me | ${countLabel} Michigan Spots`.slice(0, 60);
  }

  // Keep under ~155 chars (countLabel length varies slightly).
  let desc =
    `Today's happy hour near you — ${countLabel} MI spots with deals in Detroit, Grand Rapids, Ann Arbor, Traverse City & more. Verified hours & maps.`;
  if (desc.length > 155) {
    desc = `Today's happy hour near you — ${countLabel} MI spots in Detroit, Grand Rapids, Ann Arbor, TC & more. Verified hours & maps.`;
  }
  if (desc.length > 155) {
    desc = desc.slice(0, 152).replace(/\s+\S*$/, "") + "…";
  }

  return { title, desc, ogTitle: title, countLabel };
}
