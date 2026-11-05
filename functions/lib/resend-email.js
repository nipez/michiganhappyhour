/**
 * Shared Resend HTTP send helper for Pages Functions.
 *
 * Uses RESEND_API_KEY + LEAD_ALERT_FROM (the verified From address).
 * Callers decide the recipient — never assumes LEAD_ALERT_EMAIL.
 */

const RESEND_API = "https://api.resend.com/emails";

/** True when we can POST to Resend (API key + From). */
export function resendSendConfigured(env) {
  return Boolean(
    env &&
      String(env.RESEND_API_KEY || "").trim() &&
      String(env.LEAD_ALERT_FROM || "").trim()
  );
}

/**
 * Basic usable-email check. Returns trimmed address or "".
 */
export function usableEmail(value) {
  const s = String(value == null ? "" : value).trim();
  if (!s || s.length > 200) return "";
  // local@domain.tld — reject spaces / missing dots
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return "";
  return s;
}

/**
 * Send one plain-text email via Resend. Never throws.
 * @returns {Promise<{ ok: boolean, skipped?: boolean, status?: number, error?: string }>}
 */
export async function sendResendEmail(env, { to, subject, text } = {}) {
  if (!resendSendConfigured(env)) return { ok: true, skipped: true };

  const recipient = usableEmail(to);
  if (!recipient) return { ok: true, skipped: true };

  const from = String(env.LEAD_ALERT_FROM).trim();
  const subj = String(subject || "").trim().slice(0, 200) || "Michigan Happy Hour";
  const body = String(text || "").trim().slice(0, 12000);
  if (!body) return { ok: true, skipped: true };

  try {
    const res = await fetch(RESEND_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${String(env.RESEND_API_KEY).trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: subj,
        text: body
      })
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[resend-email] Resend failed", res.status, detail.slice(0, 500));
      return { ok: false, status: res.status, error: detail.slice(0, 300) };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    console.error(
      "[resend-email] send failed",
      String(err && err.message ? err.message : err)
    );
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

/**
 * Fire-and-forget via context.waitUntil so the user request never waits on email.
 */
export function queueResendEmail(context, env, mail, logTag = "resend-email") {
  if (!resendSendConfigured(env)) return;
  if (!mail || (!mail.subject && !mail.text)) return;
  if (!usableEmail(mail.to)) return;

  const task = sendResendEmail(env, mail).catch((err) => {
    console.error(
      `[${logTag}] waitUntil task failed`,
      String(err && err.message ? err.message : err)
    );
  });

  if (context && typeof context.waitUntil === "function") {
    context.waitUntil(task);
    return;
  }
  void task;
}
