import { stripeConfigured, stripeForm, verifyReportToken } from "./lib/stripe.js";

/**
 * GET /manage-billing?v={venueId}&t={token}
 * Signed redirect into Stripe Customer Portal (update card / cancel).
 * Uses the same HMAC token as owner reports so one shared link covers both.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return htmlPage("Database unavailable", 500);

  const url = new URL(request.url);
  const venueId = Number(url.searchParams.get("v") || "");
  const token = (url.searchParams.get("t") || "").trim();

  if (!Number.isFinite(venueId) || venueId <= 0 || !token) {
    return htmlPage("Invalid billing link.", 400);
  }
  const ok = await verifyReportToken(env, venueId, token);
  if (!ok) return htmlPage("This billing link is invalid or expired.", 403);

  if (!stripeConfigured(env)) {
    return htmlPage("Billing portal is not configured yet. Email hello@michiganhappyhour.com and we’ll help.", 503);
  }

  const venue = await env.DB.prepare(
    `SELECT id, name, town, featured, stripe_customer_id, stripe_subscription_id
     FROM venues WHERE id = ?`
  )
    .bind(venueId)
    .first();
  if (!venue) return htmlPage("Venue not found.", 404);

  if (!venue.stripe_customer_id) {
    return htmlPage(
      `${venue.name} doesn’t have an active Stripe customer on file yet. If you just paid, wait a minute and try again — or reply to your receipt email.`,
      404
    );
  }

  const origin = url.origin;
  const returnUrl = `${origin}/owner-report?v=${venueId}&t=${encodeURIComponent(token)}`;

  try {
    const session = await stripeForm(env, "/billing_portal/sessions", {
      customer: venue.stripe_customer_id,
      return_url: returnUrl
    });
    if (!session?.url) throw new Error("Portal session missing url");
    return Response.redirect(session.url, 303);
  } catch (err) {
    const detail = String(err && err.message ? err.message : err);
    return htmlPage(
      `Could not open the billing portal. ${detail.includes("No configuration") ? "Activate Customer Portal in the Stripe Dashboard (Settings → Billing → Customer portal), then try again." : "Please try again or email hello@michiganhappyhour.com."}`,
      502
    );
  }
}

function htmlPage(message, status) {
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Manage billing | Michigan Happy Hour</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=IBM+Plex+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>
body{font-family:'IBM Plex Sans',sans-serif;background:#eef2f5;color:#14202c;padding:40px 16px;line-height:1.55}
.wrap{max-width:520px;margin:0 auto;background:#fff;border:1px solid #d5e0e8;border-radius:16px;padding:28px}
h1{font-family:Fraunces,Georgia,serif;font-size:28px;margin:0 0 12px}
p{color:#5f7385;margin:0 0 14px}
a{color:#2D6A8F;font-weight:600}
</style></head><body><div class="wrap"><h1>Manage billing</h1><p>${escapeHtml(message)}</p><p><a href="/for-business/">Business page</a> · <a href="/">Home</a></p></div></body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow"
      }
    }
  );
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
