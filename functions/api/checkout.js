import { stripeConfigured, stripeForm, randomSuffix } from "../lib/stripe.js";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}

function asText(v, max = 300) {
  if (v == null) return "";
  return String(v).trim().slice(0, max);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

/** GET /api/checkout — whether online Featured checkout is available. */
export async function onRequestGet(context) {
  const { env } = context;
  return json({
    ok: true,
    configured: stripeConfigured(env),
    amount_cents: 7900,
    interval: "month",
    product: "featured_listing"
  });
}

/**
 * POST /api/checkout
 * Body: { name, town, email, venue_id?, contact_name? }
 * Creates a Stripe Checkout Session for Featured ($79/mo subscription).
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!stripeConfigured(env)) {
    return json(
      {
        ok: false,
        error: "Checkout not configured",
        detail: "Set STRIPE_SECRET_KEY (and optionally STRIPE_PRICE_ID) on Pages."
      },
      503
    );
  }
  if (!env.DB) return json({ ok: false, error: "DB binding missing" }, 500);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const name = asText(body.name, 200);
  const town = asText(body.town, 120);
  const email = asText(body.email, 200);
  const contactName = asText(body.contact_name, 160);
  const venueIdRaw = Number(body.venue_id);

  if (!name || !town || !email) {
    return json({ ok: false, error: "name, town, and email are required" }, 400);
  }

  let venue = null;
  if (Number.isFinite(venueIdRaw) && venueIdRaw > 0) {
    venue = await env.DB.prepare(`SELECT * FROM venues WHERE id = ?`).bind(venueIdRaw).first();
  }
  if (!venue) {
    venue = await env.DB.prepare(
      `SELECT * FROM venues
       WHERE status = 'published' AND lower(name) = lower(?) AND lower(town) = lower(?)
       ORDER BY featured DESC, id ASC LIMIT 1`
    )
      .bind(name, town)
      .first();
  }

  const origin = new URL(request.url).origin;
  const successUrl = `${origin}/for-business/thanks.html?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/for-business/?interest=featured&name=${encodeURIComponent(name)}&town=${encodeURIComponent(town)}&email=${encodeURIComponent(email)}#claim`;

  const metadata = {
    venue_id: venue ? String(venue.id) : "",
    venue_name: name,
    town,
    contact_name: contactName,
    product: "featured_listing"
  };

  const lineItem = env.STRIPE_PRICE_ID
    ? { price: env.STRIPE_PRICE_ID, quantity: 1 }
    : {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: 7900,
          recurring: { interval: "month" },
          product_data: {
            name: "Michigan Happy Hour — Featured listing",
            description: `Featured placement for ${name} (${town})`
          }
        }
      };

  try {
    const session = await stripeForm(env, "/checkout/sessions", {
      mode: "subscription",
      customer_email: email,
      client_reference_id: venue ? String(venue.id) : `${name}|${town}`,
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: "true",
      billing_address_collection: "auto",
      line_items: [lineItem],
      metadata,
      subscription_data: {
        metadata
      },
      integration_identifier: `featured-checkout-${randomSuffix(8)}`
    });

    // Log lead even if they abandon checkout
    try {
      await env.DB.prepare(
        `INSERT INTO submissions (
          status, submission_type, name, town, state, category, happy_hour_schedule, deals,
          contact_name, email, source, path, notes
        ) VALUES ('new', 'claim_request', ?, ?, 'Michigan', 'Featured placement', 'see current listing', 'Featured checkout started', ?, ?, 'stripe_checkout', '/for-business/', ?)`
      )
        .bind(
          name,
          town,
          contactName || null,
          email,
          venue ? `venue_id=${venue.id}; session=${session.id}` : `session=${session.id}`
        )
        .run();
    } catch {
      // non-fatal
    }

    return json({ ok: true, url: session.url, id: session.id, venue_id: venue?.id || null });
  } catch (err) {
    return json(
      {
        ok: false,
        error: "Could not start checkout",
        detail: String(err && err.message ? err.message : err)
      },
      err.status && err.status < 500 ? 400 : 502
    );
  }
}
