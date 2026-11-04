/**
 * Local smoke test for lead alert email helper (no network / Resend required).
 * Run: node scripts/test-lead-alert-email.mjs
 */
import {
  LEAD_ALERT_SUBMISSION_TYPES,
  formatCheckoutLeadAlert,
  formatSubmissionLeadAlert,
  leadAlertConfigured,
  queueLeadAlert,
  sendLeadAlertEmail
} from "../functions/lib/lead-alert-email.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(LEAD_ALERT_SUBMISSION_TYPES.has("claim_request"), "claim_request is a lead type");
assert(LEAD_ALERT_SUBMISSION_TYPES.has("new_listing"), "new_listing is a lead type");
assert(!LEAD_ALERT_SUBMISSION_TYPES.has("update"), "update tips are not money leads");

assert(!leadAlertConfigured({}), "empty env → not configured");
assert(
  !leadAlertConfigured({ RESEND_API_KEY: "re_x", LEAD_ALERT_EMAIL: "a@b.c" }),
  "missing FROM → not configured"
);
assert(
  leadAlertConfigured({
    RESEND_API_KEY: "re_x",
    LEAD_ALERT_EMAIL: "a@b.c",
    LEAD_ALERT_FROM: "MHH <alerts@example.com>"
  }),
  "all three set → configured"
);

const skipped = await sendLeadAlertEmail({}, { subject: "x", text: "y" });
assert(skipped.ok && skipped.skipped, "unset secrets → silent skip");

const claim = formatSubmissionLeadAlert(
  {
    submission_type: "claim_request",
    name: "The Little Fleet",
    town: "Traverse City",
    category: "claim",
    contact_name: "Alex",
    email: "alex@example.com",
    phone: "231-555-0100",
    source: "for_business"
  },
  { id: 42, origin: "https://michiganhappyhour.com" }
);
assert(claim.subject.includes("claim") || claim.subject.includes("for-business"), "claim subject");
assert(claim.text.includes("The Little Fleet"), "venue in body");
assert(claim.text.includes("alex@example.com"), "email in body");
assert(claim.text.includes("/admin/"), "admin link in body");
assert(claim.text.includes("Submission id: 42"), "id in body");

const listing = formatSubmissionLeadAlert(
  {
    submission_type: "new_listing",
    name: "New Pub",
    town: "Petoskey",
    email: "owner@example.com",
    source: "submit_page"
  },
  { id: 7 }
);
assert(listing.subject.includes("listing"), "new listing subject");
assert(listing.text.includes("Petoskey"), "town in body");

const featured = formatCheckoutLeadAlert(
  {
    id: "cs_test_1",
    mode: "subscription",
    customer_email: "pay@example.com",
    amount_total: 7900,
    subscription: "sub_123",
    metadata: {
      product: "featured_listing",
      venue_name: "Fleet",
      town: "Traverse City",
      venue_id: "9",
      contact_name: "Sam"
    }
  },
  { origin: "https://example.com" }
);
assert(featured.subject.includes("Featured"), "featured paid subject");
assert(featured.text.includes("pay@example.com"), "payer email");
assert(featured.text.includes("https://example.com/admin/"), "origin-aware admin link");

const sponsor = formatCheckoutLeadAlert({
  id: "cs_test_2",
  mode: "subscription",
  customer_email: "sponsor@example.com",
  amount_total: 10000,
  metadata: {
    product: "local_sponsor",
    sponsor_name: "Local Brewery",
    place_type: "town",
    place_slug: "royal-oak",
    place_name: "Royal Oak"
  }
});
assert(sponsor.subject.includes("sponsor"), "sponsor paid subject");
assert(sponsor.text.includes("town:royal-oak"), "place in body");

let waitUntilCalls = 0;
let queued = null;
const ctx = {
  waitUntil(p) {
    waitUntilCalls += 1;
    queued = p;
  }
};
queueLeadAlert(ctx, {}, { subject: "nope", text: "should not queue" });
assert(waitUntilCalls === 0, "queue is no-op when secrets unset");

const originalFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = async (url, init) => {
  fetchCalls += 1;
  assert(String(url).includes("api.resend.com"), "posts to Resend");
  const payload = JSON.parse(init.body);
  assert(payload.to[0] === "a@b.c", "to matches LEAD_ALERT_EMAIL");
  assert(payload.from.includes("alerts@example.com"), "from matches LEAD_ALERT_FROM");
  assert(payload.subject === "test", "subject passed through");
  return new Response(JSON.stringify({ id: "email_test" }), { status: 200 });
};

try {
  queueLeadAlert(
    ctx,
    {
      RESEND_API_KEY: "re_x",
      LEAD_ALERT_EMAIL: "a@b.c",
      LEAD_ALERT_FROM: "MHH <alerts@example.com>"
    },
    { subject: "test", text: "body" }
  );
  assert(waitUntilCalls === 1, "queue uses waitUntil when configured");
  const result = await queued;
  assert(result && result.ok === true, "queued send resolves ok");
  assert(fetchCalls === 1, "exactly one Resend request");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("lead-alert-email ok");
