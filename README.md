# Michigan Happy Hour

Static site for [michiganhappyhour.com](https://michiganhappyhour.com) — happy hour deals across Michigan.

## Stack (current)

- **Hosting:** Cloudflare Pages
- **Source:** this GitHub repo (`nipez/michiganhappyhour`)
- **Content:** HTML pages at the repo root (`index.html`, `regions/`, `spots/`, `blog/`, etc.)

## Local preview

```bash
npm install
npm run build:home   # compile src/homepage.jsx → js/homepage.js (no Babel in the browser)
npm run dev
```

Homepage UI source lives in `src/homepage.jsx`. After editing it, run `npm run build:home` and commit both the source and `js/homepage.js`.

## Connect Cloudflare Pages to this GitHub repo

The live site was deployed with a **direct zip upload**. Cloudflare cannot attach Git to an existing direct-upload Pages project — create a **new** Git-connected project, then move the custom domain.

### 1. Create a Git-connected Pages project

1. Open [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages).
2. **Create application → Pages → Import an existing Git repository**.
3. Authorize the **Cloudflare Workers and Pages** GitHub App if prompted.
4. Select **`nipez/michiganhappyhour`**.
5. Build settings:

   | Setting | Value |
   | --- | --- |
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `npm run build` (or leave empty if `js/homepage.js` is committed) |
   | Build output directory | `/` |

6. **Save and Deploy**. Confirm the new `*.pages.dev` URL looks correct.

### 2. Move `michiganhappyhour.com` to the new project

1. On the **old** (zip-upload) project → **Custom domains** → remove `michiganhappyhour.com` (and `www` if present).
2. On the **new** (Git) project → **Custom domains** → **Set up a custom domain** → add `michiganhappyhour.com` (and `www` if you use it).
3. DNS is already on Cloudflare for this domain in most setups; accept the suggested records.
4. When the new project is serving production traffic, you can delete the old zip-upload project.

After this, every push to `main` deploys production. Pull requests get preview URLs automatically.

### Manual CLI deploy (optional)

Requires a Cloudflare API token with Pages edit permission:

```bash
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ACCOUNT_ID=...
npm run deploy
```

## Repo layout

```
index.html          # Homepage
regions/            # City / region guides
spots/              # Spot URLs (HTML rendered live from D1)
collections/        # Curated lists
blog/               # Articles
map/                # Map view
submit/             # Submission form
img/                # Images
_headers            # Cloudflare Pages headers
_redirects          # Cloudflare Pages redirects
sitemap.xml
robots.txt
```

## Analytics

CTA + page tracking dual-writes to **GA4** and **Cloudflare D1**.

| Event | When it fires |
| --- | --- |
| `page_view` | Non-spot pages (home, map, regions, blog, …) |
| `spot_view` | Spot detail page load |
| `cta_call` | Call button / tel link |
| `cta_map` | Map button / map pin |
| `cta_directions` | Directions / Google Maps link |
| `cta_details` | Details / View Details link |

Also stored per event: visitor/session ids, path, title, referrer, UTM params, screen/viewport, language, timezone, user agent, and Cloudflare edge geo (`country`, `city`, `region`, `colo`).

### Cloudflare D1 setup (one-time)

```bash
npm install
npx wrangler login
npm run setup:d1          # creates DB, patches database_id, applies migrations
git add wrangler.jsonc && git commit -m "Set D1 database_id" && git push
```

Then redeploy Pages (Git push is enough if connected). Confirm **Settings → Bindings → DB** points at `michiganhappyhour`.

### Verify

- Browse the site and click Call / Directions on a few spots
- Open `https://michiganhappyhour.com/api/stats`
- Or `https://michiganhappyhour.com/api/stats?spot=The%20Little%20Fleet`
- Listing submissions are stored in D1 (no email required yet):
  - `https://michiganhappyhour.com/api/submit` (recent submissions)
  - also summarized on `/api/stats` as `recent_submissions`

Local:

```bash
npm run db:migrate:local
npm run dev
# elsewhere:
curl -X POST http://127.0.0.1:8788/api/track -H 'content-type: application/json' \
  -d '{"event_name":"cta_directions","spot_name":"The Little Fleet","town":"Traverse City"}'
curl http://127.0.0.1:8788/api/stats
```

### GA4

**Admin → Events → mark the `cta_*` events as Key events**.  
Explore report: rows = `spot_name`, values = event count.

## Admin

Review listing submissions and **edit venues** at `/admin/` (noindex).

```bash
printf '%s' 'your-new-password' | npx wrangler pages secret put ADMIN_PASSWORD --project-name=nwmichhappyhour
```

Open `https://michiganhappyhour.com/admin/` and unlock with that password.

| Tab | Purpose |
| --- | --- |
| **Venues** | Search/edit/create listings in D1 (`venues`). Homepage + map load from `/api/venues`. Toggle **Dog friendly**, Claimed, Featured. |
| **Venue reports** | 7/30/90-day CTAs + Featured pitch copy ($79/mo), mailto, CSV export, cold targets (not featured + phone) |
| **Monthly traffic** | Calendar-month KPIs for **claimed** listings (views, calls, directions, map, website) + MoM change, CSV, printable one-pager (`/admin/venue-report.html`) |
| **Claim outreach** | Unclaimed venues + private `/claim-traffic?t=` links, email/SMS copy, mailto (does not send). Generate/rotate tokens per venue. |
| **Submissions** | Inbox of tip/claim forms |

### Seed venues into D1 (one-time / refresh)

```bash
npm run db:migrate:remote
npm run db:seed-venues:remote
```

Public JSON: `https://michiganhappyhour.com/api/venues?format=list` (also `format=map`).

Spot detail URLs (`/spots/*.html`) are **rendered live from D1** by a Pages Function — admin saves update those pages immediately (plus homepage + map).

### OSM coverage expand (safe upsert)

Discover bars/pubs/breweries via Overpass and insert only new rows (dedupes against existing D1):

```bash
node scripts/import-osm-venues.mjs --only=port-huron,jackson --apply-remote
node scripts/import-osm-venues.mjs --pass=2 --apply-remote   # hubs tagged pass:2 only
node scripts/fix-duplicate-spots.mjs --apply-remote
node scripts/generate-sitemap.mjs
```

Omit `--only` / `--pass` to scan all hubs. Re-run anytime; curated rows are not wiped.

### Dog-friendly enrichment (OSM + websites)

Cross-reference published venues for dog signals, then apply strong hits in Admin or via SQL:

```bash
# Dump venues from Admin /api or D1 into scripts/generated/venues-dog-input.json
# (id, name, town, lat, lng, website, external_id, vibe, deals, admin_notes, dog_friendly)
node scripts/enrich-dog-friendly.mjs --from=scripts/generated/venues-dog-input.json
# Review scripts/generated/dog-friendly-report.json + dog-friendly-strong.sql
# Apply strong UPDATEs via Cloudflare D1 (does not clear existing dog_friendly=1)
```

Sources: statewide OSM `dog=yes`/`dogs=yes`, OSM tag re-check for `osm:*` rows, website phrase scan, listing text (`vibe`/`deals`/`admin_notes`). Weak “maybe” hits stay for manual review. Broader coverage needs Google Places `allowsDogs` or Yelp (API keys).

## Business / claim page

`/for-business/` — claim (free to request) & featured (**$79/mo**) packages; form saves to D1 `submissions` as `submission_type=claim_request`.

Spot PDPs, region pages, homepage cards, and `/submit/` deep-link into the form with venue context.

Optional lead alerts:

1. **Zapier / Make / Slack webhook** (claim/feature form posts only):

```bash
printf '%s' 'https://hooks.zapier.com/...' | npx wrangler pages secret put LEAD_WEBHOOK_URL --project-name=nwmichhappyhour
```

2. **Email to your inbox** (Resend) — fires for new listing submissions, venue claim / for-business leads, and completed Featured or local-sponsor Stripe checkouts. Silent no-op until all three are set:

```bash
# One-time: verify a sender domain in Resend (https://resend.com/domains),
# e.g. alerts@michiganhappyhour.com or a subdomain you control.
printf '%s' 're_...' | npx wrangler pages secret put RESEND_API_KEY --project-name=nwmichhappyhour
printf '%s' 'you@example.com' | npx wrangler pages secret put LEAD_ALERT_EMAIL --project-name=nwmichhappyhour
printf '%s' 'Michigan Happy Hour <alerts@michiganhappyhour.com>' | npx wrangler pages secret put LEAD_ALERT_FROM --project-name=nwmichhappyhour
```

`LEAD_ALERT_EMAIL` is the only recipient for **owner** alerts (not venue owners or the public). Emails are sent in the background via `waitUntil` so form/checkout responses never wait on or fail because of Resend.

3. **Customer thank-you / payment receipts** (same Resend key + From) — short plain-text emails **to the submitter’s email** (never to `LEAD_ALERT_EMAIL`) when we have a usable address:

   - New listing submission (`submission_type=new_listing`)
   - Claim / for-business inquiry (`submission_type=claim_request`)
   - Successful Featured Stripe checkout
   - Successful local-sponsor Stripe checkout (`product=local_sponsor`)

   Silent no-op until `RESEND_API_KEY` and `LEAD_ALERT_FROM` are set (no extra secrets). Featured receipts include a signed `/manage-billing` link when `venue_id` + `REPORT_SECRET`/`ADMIN_PASSWORD` allow it.

Admin **Submissions** can filter by `claim_request`. After verify, toggle **Claimed / verified owner** on the venue (green Verified badge). After payment, also toggle **Featured**. Publishing a `claim_request` marks the venue claimed automatically.

### Featured Stripe checkout ($79/mo)

Online checkout is available when these Pages secrets are set on `nwmichhappyhour`:

```bash
printf '%s' 'rk_live_...' | npx wrangler pages secret put STRIPE_SECRET_KEY --project-name=nwmichhappyhour
printf '%s' 'whsec_...' | npx wrangler pages secret put STRIPE_WEBHOOK_SECRET --project-name=nwmichhappyhour
# optional — otherwise Checkout creates an inline $79/mo price
printf '%s' 'price_...' | npx wrangler pages secret put STRIPE_PRICE_ID --project-name=nwmichhappyhour
```

Webhook endpoint: `https://michiganhappyhour.com/api/stripe-webhook`  
Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

Successful payment sets `featured=1` + `claimed=1` on the matching venue.

### Stripe Customer Portal (manage / cancel)

Enable the [Customer Portal](https://dashboard.stripe.com/settings/billing/portal) in Stripe Dashboard (allow cancel + payment method update). Then:

- Admin → Venues → **Billing portal link** copies `/manage-billing?v=&t=` (same HMAC as owner reports)
- Owner report pages show **Manage billing** when `stripe_customer_id` is set
- Portal return URL lands back on the owner report

### Owner KPI report links

Admin → Venues → **Owner report link** copies a signed URL (`/owner-report?v=&t=`). Uses `REPORT_SECRET` if set, otherwise `ADMIN_PASSWORD`.

## SEO notes

- Sitemap: `sitemap.xml` — rebuild with `node scripts/generate-sitemap.mjs` after venue imports, then resubmit in GSC
- After big coverage expands: refresh homepage `index.html` noscript region list + “1,200+” copy, map filter chips / noscript, and blog region directory
- Spot pages + homepage listings should stay linked via real `/spots/{slug}` URLs
- `/admin/`, `/api/`, thanks page, and `index-backup.html` are disallowed / noindex
- GSC ops after content ships: **Sitemaps → resubmit** `https://michiganhappyhour.com/sitemap.xml`; **URL Inspection → Request indexing** for new blog posts and any updated region hubs
- GSC weekly: Performance → Queries/Pages, sort by impressions, fix titles/meta on CTR &lt;2% or position 8–20
- New posts: `node scripts/generate-seo-posts.mjs` (or edit `blog/*.html` directly)

## IndexNow

Pings Bing/Yandex/etc. when URLs are new or their sitemap `<lastmod>` changes. **No Cloudflare/GitHub secrets required** — the key is public by design.

| Item | Value |
| --- | --- |
| Key file (public) | https://michiganhappyhour.com/5a011e7451e43a4c03bacd51c0ba3ed1.txt |
| Key source in repo | `5a011e7451e43a4c03bacd51c0ba3ed1.txt` (body = key) |
| Submit script | `scripts/indexnow-submit.mjs` (`npm run indexnow`) |
| Auto-run | GitHub Action `.github/workflows/indexnow.yml` on every push to `main` (waits ~90s for Pages, then submits) |

### How changed URLs are detected

1. Explicit URLs passed on the CLI (or `INDEXNOW_URLS`)
2. Else diff current `sitemap.xml` vs previous snapshot, in order:
   - `INDEXNOW_PREV_SHA` / `--prev=<sha>` (used by the Action with `github.event.before`)
   - `scripts/generated/indexnow-state.json` (local cheap persistence; gitignored)
   - `git show HEAD~1:sitemap.xml` when available
3. Else fall back to sitemap URLs whose `<lastmod>` is within the last **7 days**

Batches at most 10,000 URLs per POST to `https://api.indexnow.org/indexnow`. Non-2xx responses are warnings only (exit 0) so deploys are never blocked.

### Manual / dry-run

```bash
# Print JSON payload only (no network)
INDEXNOW_DRY_RUN=1 npm run indexnow
INDEXNOW_DRY_RUN=1 npm run indexnow -- https://michiganhappyhour.com/blog/monday-happy-hour-michigan

# Submit specific URLs
npm run indexnow -- https://michiganhappyhour.com/blog/monday-happy-hour-michigan \
  https://michiganhappyhour.com/regions/traverse-city

# Auto-detect from sitemap diff / lastmod fallback
npm run indexnow

# Smoke test (key file + dry-run)
npm run test:indexnow
```

## Next (planned)

- Enrich Port Huron / UP OSM venues with verified hours (owner tips + Places)

