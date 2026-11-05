/**
 * Customer-facing thank-you / payment-confirmation emails (to the submitter).
 *
 * Reuses RESEND_API_KEY + LEAD_ALERT_FROM. Never sends to LEAD_ALERT_EMAIL.
 * Silent no-op when Resend/From unset or recipient email is missing/invalid.
 */

import {
  queueResendEmail,
  resendSendConfigured,
  usableEmail
} from "./resend-email.js";

const DEFAULT_ORIGIN = "https://michiganhappyhour.com";

/** Submission types that get a customer receipt. */
export const CUSTOMER_RECEIPT_SUBMISSION_TYPES = new Set([
  "claim_request",
  "new_listing"
]);

export function customerReceiptConfigured(env) {
  return resendSendConfigured(env);
}

/**
 * Queue a receipt to the submitter. Never throws; never blocks the response.
 * @param {{ to?: string, subject?: string, text?: string }} mail
 */
export function queueCustomerReceipt(context, env, mail) {
  queueResendEmail(context, env, mail, "customer-receipt-email");
}

function placeLabel(name, town) {
  const n = String(name || "").trim();
  const t = String(town || "").trim();
  if (n && t) return `${n} (${t})`;
  return n || t || "";
}

function siteLine(origin) {
  const base = String(origin || DEFAULT_ORIGIN).replace(/\/$/, "") || DEFAULT_ORIGIN;
  return base;
}

/**
 * Receipt for a D1 submissions row (new listing or claim / for-business).
 * @returns {{ to: string, subject: string, text: string } | null}
 */
export function formatSubmissionCustomerReceipt(row, { origin = DEFAULT_ORIGIN } = {}) {
  const to = usableEmail(row?.email);
  if (!to) return null;

  const type = String(row?.submission_type || "").trim();
  const place = placeLabel(row?.name, row?.town);
  const site = siteLine(origin);

  if (type === "claim_request") {
    const subject = place
      ? `We got your request for ${place}`
      : "We got your Michigan Happy Hour request";
    const text = [
      place
        ? `Thanks for reaching out about ${place}.`
        : "Thanks for reaching out.",
      "",
      "We received your claim / for-business request and will follow up soon.",
      "",
      "— Michigan Happy Hour",
      site
    ].join("\n");
    return { to, subject, text };
  }

  // new_listing (and any other wired type)
  const subject = place
    ? `Thanks for submitting ${place}`
    : "Thanks for your Michigan Happy Hour submission";
  const text = [
    place ? `Thanks for submitting ${place}.` : "Thanks for your submission.",
    "",
    "We got your listing tip. Our team will review it and publish when everything looks good.",
    "",
    "— Michigan Happy Hour",
    site
  ].join("\n");
  return { to, subject, text };
}

/**
 * Receipt for a completed Stripe Checkout session (Featured or local sponsor).
 * @param {object} session
 * @param {{ origin?: string, billingUrl?: string|null }} [opts]
 * @returns {{ to: string, subject: string, text: string } | null}
 */
export function formatCheckoutCustomerReceipt(
  session,
  { origin = DEFAULT_ORIGIN, billingUrl = null } = {}
) {
  const meta = (session && session.metadata) || {};
  const to = usableEmail(
    session?.customer_email || session?.customer_details?.email || meta.email
  );
  if (!to) return null;

  const product = String(meta.product || "featured_listing").trim() || "featured_listing";
  const isSponsor = product === "local_sponsor" || product === "sponsor";
  const site = siteLine(origin);

  if (isSponsor) {
    const sponsorName = String(meta.sponsor_name || meta.venue_name || "").trim();
    const placeName = String(meta.place_name || meta.town || "").trim();
    const placeSlug = String(meta.place_slug || "").trim();
    const where =
      placeName ||
      (placeSlug ? placeSlug.replace(/-/g, " ") : "") ||
      "your town";

    const subject = placeName
      ? `Sponsorship confirmed — ${placeName}`
      : "Your local sponsorship is confirmed";
    const who = sponsorName || "Your business";
    const text = [
      `Thanks — ${who} is set as the local sponsor for ${where} on Michigan Happy Hour.`,
      "",
      "We appreciate your support.",
      "",
      "— Michigan Happy Hour",
      site
    ].join("\n");
    return { to, subject, text };
  }

  // Featured listing
  const venueName = String(meta.venue_name || "").trim();
  const town = String(meta.town || "").trim();
  const place = placeLabel(venueName, town) || "your venue";
  const subject = venueName
    ? `You're Featured — ${venueName}`
    : "You're Featured on Michigan Happy Hour";
  const lines = [
    `Thanks for supporting Michigan Happy Hour. ${place} is now Featured.`,
    ""
  ];
  const billing = String(billingUrl || "").trim();
  if (billing) {
    lines.push("Manage or cancel billing anytime:");
    lines.push(billing);
    lines.push("");
  } else {
    lines.push(
      "Questions about billing? Reply to this email or write hello@michiganhappyhour.com."
    );
    lines.push("");
  }
  lines.push("— Michigan Happy Hour", site);
  return { to, subject, text: lines.join("\n") };
}
