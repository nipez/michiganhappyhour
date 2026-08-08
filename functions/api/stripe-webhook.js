import { verifyStripeWebhook } from "../lib/stripe.js";

/**
 * POST /api/stripe-webhook
 * Fulfill Featured subscriptions: set featured(+claimed) on matching venue.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return new Response("DB missing", { status: 500 });
  if (!env.STRIPE_WEBHOOK_SECRET) return new Response("Webhook secret missing", { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature") || "";

  let event;
  try {
    event = await verifyStripeWebhook(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      await fulfillCheckout(env, event.data.object);
    } else if (event.type === "customer.subscription.deleted") {
      await clearFeatured(env, event.data.object);
    } else if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      if (sub.status === "active" || sub.status === "trialing") {
        await markFeaturedFromSubscription(env, sub);
      } else if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
        await clearFeatured(env, sub);
      }
    }
  } catch (err) {
    return new Response(`Handler Error: ${err.message}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

async function fulfillCheckout(env, session) {
  if (!session || session.mode !== "subscription") return;
  const meta = session.metadata || {};
  const venueId = Number(meta.venue_id || session.client_reference_id);
  const name = String(meta.venue_name || "").trim();
  const town = String(meta.town || "").trim();
  const customerId = typeof session.customer === "string" ? session.customer : null;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : null;

  const venue = await findVenue(env, venueId, name, town);
  if (!venue) return;

  await env.DB.prepare(
    `UPDATE venues SET
      featured = 1,
      claimed = 1,
      claimed_at = COALESCE(claimed_at, date('now')),
      stripe_customer_id = COALESCE(?, stripe_customer_id),
      stripe_subscription_id = COALESCE(?, stripe_subscription_id),
      last_verified_at = date('now'),
      admin_notes = TRIM(COALESCE(admin_notes,'') || ?),
      updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      customerId,
      subscriptionId,
      `\nFeatured via Stripe checkout ${session.id || ""}`.trimEnd(),
      venue.id
    )
    .run();

  if (session.customer_email || meta.contact_name) {
    try {
      await env.DB.prepare(
        `UPDATE submissions SET status = 'published'
         WHERE submission_type = 'claim_request'
           AND status IN ('new','reviewed')
           AND lower(name) = lower(?)
           AND lower(town) = lower(?)`
      )
        .bind(venue.name, venue.town)
        .run();
    } catch {
      // ignore
    }
  }
}

async function markFeaturedFromSubscription(env, sub) {
  const meta = sub.metadata || {};
  const venueId = Number(meta.venue_id);
  const venue = await findVenue(env, venueId, meta.venue_name, meta.town);
  if (!venue) return;
  const customerId = typeof sub.customer === "string" ? sub.customer : null;
  await env.DB.prepare(
    `UPDATE venues SET
      featured = 1,
      claimed = 1,
      claimed_at = COALESCE(claimed_at, date('now')),
      stripe_customer_id = COALESCE(?, stripe_customer_id),
      stripe_subscription_id = ?,
      updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(customerId, sub.id, venue.id)
    .run();
}

async function clearFeatured(env, sub) {
  const meta = sub.metadata || {};
  const venueId = Number(meta.venue_id);
  let venue = await findVenue(env, venueId, meta.venue_name, meta.town);
  if (!venue && sub.id) {
    venue = await env.DB.prepare(
      `SELECT * FROM venues WHERE stripe_subscription_id = ? LIMIT 1`
    )
      .bind(sub.id)
      .first();
  }
  if (!venue) return;
  await env.DB.prepare(
    `UPDATE venues SET
      featured = 0,
      stripe_subscription_id = NULL,
      admin_notes = TRIM(COALESCE(admin_notes,'') || ?),
      updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(`\nFeatured ended (Stripe ${sub.id || "subscription"})`, venue.id)
    .run();
}

async function findVenue(env, venueId, name, town) {
  if (Number.isFinite(venueId) && venueId > 0) {
    const byId = await env.DB.prepare(`SELECT * FROM venues WHERE id = ?`).bind(venueId).first();
    if (byId) return byId;
  }
  const n = String(name || "").trim();
  const t = String(town || "").trim();
  if (!n || !t) return null;
  return env.DB.prepare(
    `SELECT * FROM venues
     WHERE lower(name) = lower(?) AND lower(town) = lower(?)
     ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, id
     LIMIT 1`
  )
    .bind(n, t)
    .first();
}
