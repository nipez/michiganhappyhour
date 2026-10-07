/**
 * Shared noindex 404 HTML for missing spots/towns/regions/collections.
 * Links: home, regions, search (GSC-friendly helpful 404).
 */
export function notFoundPage({ title, message }) {
  const safeTitle = String(title || "Page not found");
  const safeMsg = String(
    message || "That page isn’t available (or the link is outdated)."
  );
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${safeTitle}</title>
<meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="/favicon.ico" sizes="any">
<style>body{font-family:system-ui,sans-serif;background:#F5F7FA;color:#1B2838;padding:40px 20px;text-align:center;line-height:1.5}a{color:#E8614D;font-weight:700}p{color:#4A6274;max-width:420px;margin:12px auto 20px}.links{display:flex;flex-wrap:wrap;gap:14px;justify-content:center}a.sec{color:#2D6A8F;font-weight:600}</style>
</head><body><h1>${safeTitle}</h1><p>${safeMsg}</p>
<div class="links"><a href="/">Home</a><a class="sec" href="/regions">Regions</a><a class="sec" href="/?q=">Search</a></div>
</body></html>`;
}
