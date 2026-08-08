/**
 * Minimal Stripe helpers for Cloudflare Pages (fetch + Web Crypto).
 * No stripe-node dependency required.
 */

const STRIPE_API = "https://api.stripe.com/v1";
const STRIPE_VERSION = "2026-06-24.dahlia";

export function stripeConfigured(env) {
  return Boolean(env && env.STRIPE_SECRET_KEY);
}

export async function stripeForm(env, path, params, { method = "POST" } = {}) {
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY missing");
  const body = new URLSearchParams();
  flattenParams(params, body);

  const res = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_VERSION
    },
    body: method === "GET" ? undefined : body
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || `Stripe HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.stripe = data?.error || null;
    throw err;
  }
  return data;
}

function flattenParams(obj, out, prefix = "") {
  Object.entries(obj || {}).forEach(([key, value]) => {
    if (value == null) return;
    const k = prefix ? `${prefix}[${key}]` : key;
    if (typeof value === "object" && !Array.isArray(value)) {
      flattenParams(value, out, k);
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item != null && typeof item === "object") flattenParams(item, out, `${k}[${i}]`);
        else if (item != null) out.append(`${k}[${i}]`, String(item));
      });
    } else {
      out.append(k, String(value));
    }
  });
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacSha256Hex(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Verify Stripe-Signature header against raw body text. */
export async function verifyStripeWebhook(rawBody, signatureHeader, webhookSecret) {
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET missing");
  if (!signatureHeader) throw new Error("Missing Stripe-Signature");

  const parts = Object.fromEntries(
    String(signatureHeader)
      .split(",")
      .map((p) => p.trim().split("="))
      .filter((p) => p.length === 2)
  );
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) throw new Error("Invalid Stripe-Signature");

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 60 * 5) throw new Error("Stripe timestamp outside tolerance");

  const expected = await hmacSha256Hex(webhookSecret, `${timestamp}.${rawBody}`);
  if (!timingSafeEqual(expected, v1)) throw new Error("Stripe signature mismatch");

  return JSON.parse(rawBody);
}

export function randomSuffix(n = 8) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  for (let i = 0; i < n; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** HMAC token for shareable owner reports. */
export async function reportToken(env, venueId) {
  const secret = env.REPORT_SECRET || env.ADMIN_PASSWORD;
  if (!secret) throw new Error("REPORT_SECRET or ADMIN_PASSWORD required");
  return hmacSha256Hex(secret, `owner-report:${Number(venueId)}`);
}

export async function verifyReportToken(env, venueId, token) {
  if (!token) return false;
  try {
    const expected = await reportToken(env, venueId);
    return timingSafeEqual(String(token).toLowerCase(), expected.toLowerCase());
  } catch {
    return false;
  }
}
