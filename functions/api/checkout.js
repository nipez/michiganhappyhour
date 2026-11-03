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

/**
 * GET /api/checkout — whether online checkout is available.
 * Optional ?product=local_sponsor|featured_listing
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const product = asText(url.searchParams.get("product") || "featured_listing", 40);
  const isSponsor = product === "local_sponsor" || product === "sponsor";
  return json({
    ok: true,
    configured: stripeConfigured(env),
    amount_cents: isSponsor ? 10000 : 7900,
    interval: "month",
    product: isSponsor ? "local_sponsor" : "featured_listing"
  });
}

/**
 * POST /api/checkout
 * Featured: { product?: 'featured_listing', name, town, email, venue_id?, contact_name? }
 * Sponsor:  { product: 'local_sponsor', name, email, place_type, place_slug, place_name?, contact_name? }
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!stripeConfigured(env)) {
    return json(
      {
        ok: false,
        error: "Checkout not configured",
        detail: "Set STRIPE_SECRET_KEY (and optionally STRIPE_PRICE_ID / STRIPE_SPONSOR_PRICE_ID) on Pages."
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

  const productRaw = asText(body.product || "featured_listing", 40).toLowerCase();
  if (productRaw === "local_sponsor" || productRaw === "sponsor") {
    return createSponsorCheckout(request, env, body);
  }
  return createFeaturedCheckout(request, env, body);
}

async function createFeaturedCheckout(request, env, body) {
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

async function createSponsorCheckout(request, env, body) {
  const name = asText(body.name, 200);
  const email = asText(body.email, 200);
  const contactName = asText(body.contact_name, 160);
  let placeType = asText(body.place_type, 20).toLowerCase();
  const placeSlug = asText(body.place_slug, 120)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const placeName = asText(body.place_name || body.town, 160);

  if (placeType !== "town" && placeType !== "region") placeType = "town";

  if (!name || !email) {
    return json({ ok: false, error: "name and email are required" }, 400);
  }
  if (!placeSlug) {
    return json({ ok: false, error: "place_slug is required" }, 400);
  }

  const origin = new URL(request.url).origin;
  const qs = new URLSearchParams({
    type: placeType,
    slug: placeSlug,
    name: placeName || placeSlug,
    email,
    business: name
  });
  const successUrl = `${origin}/sponsor/thanks.html?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/sponsor/?${qs.toString()}`;

  const label = placeName || placeSlug;
  const metadata = {
    product: "local_sponsor",
    place_type: placeType,
    place_slug: placeSlug,
    place_name: label,
    sponsor_name: name,
    contact_name: contactName
  };

  const lineItem = env.STRIPE_SPONSOR_PRICE_ID
    ? { price: env.STRIPE_SPONSOR_PRICE_ID, quantity: 1 }
    : {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: 10000,
          recurring: { interval: "month" },
          product_data: {
            name: "Michigan Happy Hour — Local sponsor",
            description: `Exclusive ${placeType} sponsor for ${label}`
          }
        }
      };

  try {
    const session = await stripeForm(env, "/checkout/sessions", {
      mode: "subscription",
      customer_email: email,
      client_reference_id: `sponsor:${placeType}:${placeSlug}`,
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: "true",
      billing_address_collection: "auto",
      line_items: [lineItem],
      metadata,
      subscription_data: {
        metadata
      },
      integration_identifier: `sponsor-checkout-${randomSuffix(8)}`
    });

    try {
      await env.DB.prepare(
        `INSERT INTO submissions (
          status, submission_type, name, town, state, category, happy_hour_schedule, deals,
          contact_name, email, source, path, notes
        ) VALUES ('new', 'claim_request', ?, ?, 'Michigan', 'Local sponsor', 'n/a', 'Local sponsor checkout started', ?, ?, 'stripe_checkout', '/sponsor/', ?)`
      )
        .bind(
          name,
          label,
          contactName || null,
          email,
          `product=local_sponsor; ${placeType}=${placeSlug}; session=${session.id}`
        )
        .run();
    } catch {
      // non-fatal
    }

    return json({ ok: true, url: session.url, id: session.id, product: "local_sponsor" });
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
