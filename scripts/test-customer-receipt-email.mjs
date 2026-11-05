/**
 * Local smoke test for customer receipt emails (no network / Resend required).
 * Run: node scripts/test-customer-receipt-email.mjs
 */
import {
  CUSTOMER_RECEIPT_SUBMISSION_TYPES,
  customerReceiptConfigured,
  formatCheckoutCustomerReceipt,
  formatSubmissionCustomerReceipt,
  queueCustomerReceipt
} from "../functions/lib/customer-receipt-email.js";
import {
  leadAlertConfigured,
  queueLeadAlert,
  sendLeadAlertEmail
} from "../functions/lib/lead-alert-email.js";
import { usableEmail } from "../functions/lib/resend-email.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(CUSTOMER_RECEIPT_SUBMISSION_TYPES.has("claim_request"), "claim is a receipt type");
assert(CUSTOMER_RECEIPT_SUBMISSION_TYPES.has("new_listing"), "listing is a receipt type");
assert(!CUSTOMER_RECEIPT_SUBMISSION_TYPES.has("update"), "updates are not receipted");

assert(!usableEmail(""), "empty email rejected");
assert(!usableEmail("not-an-email"), "bad email rejected");
assert(usableEmail("  alex@example.com  ") === "alex@example.com", "trims usable email");

assert(!customerReceiptConfigured({}), "empty env → not configured");
assert(
  !customerReceiptConfigured({ RESEND_API_KEY: "re_x" }),
  "missing FROM → not configured"
);
assert(
  customerReceiptConfigured({
    RESEND_API_KEY: "re_x",
    LEAD_ALERT_FROM: "MHH <alerts@example.com>"
  }),
  "key + From → configured (no LEAD_ALERT_EMAIL required)"
);

// Owner alerts still need all three; receipts must not depend on LEAD_ALERT_EMAIL.
assert(
  !leadAlertConfigured({
    RESEND_API_KEY: "re_x",
    LEAD_ALERT_FROM: "MHH <alerts@example.com>"
  }),
  "owner alert still needs LEAD_ALERT_EMAIL"
);

assert(
  formatSubmissionCustomerReceipt({
    submission_type: "new_listing",
    name: "New Pub",
    town: "Petoskey"
  }) === null,
  "no submitter email → null receipt"
);

const listing = formatSubmissionCustomerReceipt(
  {
    submission_type: "new_listing",
    name: "New Pub",
    town: "Petoskey",
    email: "owner@example.com"
  },
  { origin: "https://michiganhappyhour.com" }
);
assert(listing && listing.to === "owner@example.com", "listing receipt → submitter");
assert(listing.subject.includes("New Pub"), "venue in subject");
assert(listing.text.includes("Petoskey"), "town in body");
assert(listing.text.includes("review"), "sets review expectation");
assert(!listing.text.includes("LEAD_ALERT"), "no owner address in body");

const claim = formatSubmissionCustomerReceipt({
  submission_type: "claim_request",
  name: "The Little Fleet",
  town: "Traverse City",
  email: "alex@example.com"
});
assert(claim && claim.to === "alex@example.com", "claim receipt → submitter");
assert(claim.text.toLowerCase().includes("follow up") || claim.text.includes("follow up"), "claim expectation");

const featured = formatCheckoutCustomerReceipt(
  {
    id: "cs_test_1",
    customer_email: "pay@example.com",
    metadata: {
      product: "featured_listing",
      venue_name: "Fleet",
      town: "Traverse City",
      venue_id: "9"
    }
  },
  {
    origin: "https://example.com",
    billingUrl: "https://example.com/manage-billing?v=9&t=abc"
  }
);
assert(featured && featured.to === "pay@example.com", "featured receipt → payer");
assert(featured.subject.includes("Featured"), "featured subject");
assert(featured.text.includes("manage-billing"), "billing link when provided");
assert(featured.to !== "a@b.c", "featured not sent to owner inbox address");

const featuredNoBilling = formatCheckoutCustomerReceipt({
  customer_email: "pay@example.com",
  metadata: { product: "featured_listing", venue_name: "Fleet", town: "TC" }
});
assert(
  featuredNoBilling.text.includes("hello@michiganhappyhour.com"),
  "fallback billing copy without portal link"
);

const sponsor = formatCheckoutCustomerReceipt({
  customer_email: "sponsor@example.com",
  metadata: {
    product: "local_sponsor",
    sponsor_name: "Local Brewery",
    place_name: "Royal Oak",
    place_slug: "royal-oak"
  }
});
assert(sponsor && sponsor.to === "sponsor@example.com", "sponsor receipt → payer");
assert(sponsor.text.includes("Royal Oak"), "place in sponsor body");
assert(sponsor.text.includes("Local Brewery"), "sponsor name in body");

assert(
  formatCheckoutCustomerReceipt({
    metadata: { product: "featured_listing", venue_name: "X" }
  }) === null,
  "checkout without email → null"
);

let waitUntilCalls = 0;
let queued = null;
const ctx = {
  waitUntil(p) {
    waitUntilCalls += 1;
    queued = p;
  }
};

queueCustomerReceipt(ctx, {}, {
  to: "owner@example.com",
  subject: "nope",
  text: "should not queue"
});
assert(waitUntilCalls === 0, "queue is no-op when secrets unset");

queueCustomerReceipt(
  ctx,
  {
    RESEND_API_KEY: "re_x",
    LEAD_ALERT_FROM: "MHH <alerts@example.com>"
  },
  { to: "", subject: "x", text: "y" }
);
assert(waitUntilCalls === 0, "queue is no-op without usable recipient");

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
let lastPayload = null;
globalThis.fetch = async (url, opts) => {
  fetchCalls += 1;
  assert(String(url).includes("api.resend.com"), "posts to Resend");
  lastPayload = JSON.parse(opts.body);
  return new Response(JSON.stringify({ id: "email_test" }), { status: 200 });
};

try {
  const env = {
    RESEND_API_KEY: "re_x",
    LEAD_ALERT_EMAIL: "owner-inbox@example.com",
    LEAD_ALERT_FROM: "MHH <alerts@example.com>"
  };

  queueCustomerReceipt(ctx, env, {
    to: "submitter@example.com",
    subject: "Thanks",
    text: "body"
  });
  assert(waitUntilCalls === 1, "customer queue uses waitUntil");
  const customerResult = await queued;
  assert(customerResult && customerResult.ok === true, "customer send ok");
  assert(fetchCalls === 1, "one Resend request for customer");
  assert(lastPayload.to[0] === "submitter@example.com", "recipient is submitter");
  assert(lastPayload.to[0] !== env.LEAD_ALERT_EMAIL, "customer ≠ owner inbox");
  assert(lastPayload.from.includes("alerts@example.com"), "reuses LEAD_ALERT_FROM");

  // Owner alert still goes only to LEAD_ALERT_EMAIL (regression check).
  waitUntilCalls = 0;
  queued = null;
  queueLeadAlert(ctx, env, { subject: "lead", text: "owner body" });
  assert(waitUntilCalls === 1, "owner queue still works");
  const ownerResult = await queued;
  assert(ownerResult && ownerResult.ok === true, "owner send ok");
  assert(fetchCalls === 2, "second Resend request for owner");
  assert(lastPayload.to[0] === "owner-inbox@example.com", "owner alert → LEAD_ALERT_EMAIL only");

  const skippedOwner = await sendLeadAlertEmail(
    { RESEND_API_KEY: "re_x", LEAD_ALERT_FROM: "MHH <a@b.c>" },
    { subject: "x", text: "y" }
  );
  assert(skippedOwner.ok && skippedOwner.skipped, "owner send skips without LEAD_ALERT_EMAIL");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("customer-receipt-email ok");
