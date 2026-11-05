/**
 * Optional owner inbox alerts via Resend HTTP API.
 *
 * Silent no-op when RESEND_API_KEY, LEAD_ALERT_EMAIL, or LEAD_ALERT_FROM are unset
 * so production keeps working before secrets are configured.
 *
 * Alerts go only to LEAD_ALERT_EMAIL (never venue owners / the public).
 */

import {
  queueResendEmail,
  resendSendConfigured,
  sendResendEmail
} from "./resend-email.js";

const DEFAULT_ORIGIN = "https://michiganhappyhour.com";

/** Submission types that warrant an owner alert. */
export const LEAD_ALERT_SUBMISSION_TYPES = new Set(["claim_request", "new_listing"]);

export function leadAlertConfigured(env) {
  return Boolean(
    resendSendConfigured(env) && String(env?.LEAD_ALERT_EMAIL || "").trim()
  );
}

/**
 * Send one plain-text alert email to LEAD_ALERT_EMAIL. Never throws.
 * @returns {Promise<{ ok: boolean, skipped?: boolean, status?: number, error?: string }>}
 */
export async function sendLeadAlertEmail(env, { subject, text } = {}) {
  if (!leadAlertConfigured(env)) return { ok: true, skipped: true };
  return sendResendEmail(env, {
    to: String(env.LEAD_ALERT_EMAIL).trim(),
    subject,
    text
  });
}

/**
 * Fire-and-forget via context.waitUntil so the user request never waits on email.
 * Safe no-op when secrets are missing or waitUntil is absent.
 */
export function queueLeadAlert(context, env, alert) {
  if (!leadAlertConfigured(env)) return;
  if (!alert || (!alert.subject && !alert.text)) return;

  queueResendEmail(
    context,
    env,
    {
      to: String(env.LEAD_ALERT_EMAIL).trim(),
      subject: alert.subject,
      text: alert.text
    },
    "lead-alert-email"
  );
}

function line(label, value) {
  const v = value == null ? "" : String(value).trim();
  if (!v) return null;
  return `${label}: ${v}`;
}

function adminSubmissionsUrl(origin) {
  const base = String(origin || DEFAULT_ORIGIN).replace(/\/$/, "") || DEFAULT_ORIGIN;
  return `${base}/admin/`;
}

/**
 * Build subject + body for a D1 submissions row (submit / for-business forms).
 */
export function formatSubmissionLeadAlert(row, { id = null, origin = DEFAULT_ORIGIN } = {}) {
  const type = String(row?.submission_type || "submission").trim() || "submission";
  const name = String(row?.name || "Unknown venue").trim();
  const town = String(row?.town || "").trim();
  const place = town ? `${name} (${town})` : name;

  let eventLabel = "New listing submission";
  if (type === "claim_request") {
    const cat = String(row?.category || "").toLowerCase();
    if (cat.includes("sponsor")) eventLabel = "Local sponsor inquiry / checkout started";
    else if (cat.includes("featured")) eventLabel = "Featured listing inquiry / checkout started";
    else eventLabel = "Venue claim / for-business lead";
  }

  const subject = `[MHH lead] ${eventLabel}: ${place}`;
  const lines = [
    eventLabel,
    "",
    line("Venue", name),
    line("Town", town || null),
    line("Type", type),
    line("Category", row?.category),
    line("Package / deals note", row?.deals),
    line("Contact", row?.contact_name),
    line("Role", row?.role),
    line("Email", row?.email),
    line("Phone", row?.phone),
    line("Website", row?.website),
    line("Source", row?.source),
    id != null ? line("Submission id", id) : null,
    "",
    `Admin: ${adminSubmissionsUrl(origin)} (Submissions tab)`
  ].filter(Boolean);

  return { subject, text: lines.join("\n") };
}

/**
 * Build subject + body for a completed Stripe Checkout session (Featured or local sponsor).
 */
export function formatCheckoutLeadAlert(session, { origin = DEFAULT_ORIGIN } = {}) {
  const meta = (session && session.metadata) || {};
  const product = String(meta.product || "featured_listing").trim() || "featured_listing";
  const isSponsor = product === "local_sponsor" || product === "sponsor";

  const venueName = String(meta.venue_name || meta.sponsor_name || "").trim();
  const town = String(meta.town || meta.place_name || "").trim();
  const placeSlug = String(meta.place_slug || "").trim();
  const placeType = String(meta.place_type || "").trim();
  const contactName = String(meta.contact_name || "").trim();
  const email =
    String(session?.customer_email || session?.customer_details?.email || "").trim();
  const amountTotal =
    typeof session?.amount_total === "number" ? session.amount_total : null;

  const place = town
    ? `${venueName || "Listing"} (${town})`
    : venueName || (placeSlug ? `${placeType || "place"}/${placeSlug}` : "unknown");

  const eventLabel = isSponsor
    ? "Local sponsor checkout paid"
    : "Featured listing checkout paid";
  const subject = `[MHH lead] ${eventLabel}: ${place}`;

  const lines = [
    eventLabel,
    "",
    line("Product", isSponsor ? "local_sponsor ($100/mo)" : "featured_listing ($79/mo)"),
    line("Venue / business", venueName || null),
    line("Town", meta.town || null),
    line("Place", placeType && placeSlug ? `${placeType}:${placeSlug}` : null),
    line("Place label", meta.place_name || null),
    line("Venue id", meta.venue_id || null),
    line("Contact", contactName || null),
    line("Email", email || null),
    amountTotal != null ? line("Amount (cents)", amountTotal) : null,
    line("Stripe session", session?.id || null),
    line("Subscription", typeof session?.subscription === "string" ? session.subscription : null),
    "",
    `Admin: ${adminSubmissionsUrl(origin)} (Submissions tab; mark Featured / add Sponsors after verify)`
  ].filter(Boolean);

  return { subject, text: lines.join("\n") };
}
