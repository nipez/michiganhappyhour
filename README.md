# Michigan Happy Hour

Static site for [michiganhappyhour.com](https://michiganhappyhour.com) — happy hour deals across Michigan.

## Stack (current)

- **Hosting:** Cloudflare Pages
- **Source:** this GitHub repo (`nipez/michiganhappyhour`)
- **Content:** HTML pages at the repo root (`index.html`, `regions/`, `spots/`, `blog/`, etc.)

## Local preview

```bash
npm install
npm run dev
```

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
   | Build command | *(leave empty)* |
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
| **Venues** | Search/edit/create listings in D1 (`venues`). Homepage + map load from `/api/venues`. |
| **Venue reports** | 7/30/90-day Call / Map / Directions / Details / views + outreach blurb |
| **Submissions** | Inbox of tip/claim forms |

### Seed venues into D1 (one-time / refresh)

```bash
npm run db:migrate:remote
npm run db:seed-venues:remote
```

Public JSON: `https://michiganhappyhour.com/api/venues?format=list` (also `format=map`).

Spot detail URLs (`/spots/*.html`) are **rendered live from D1** by a Pages Function — admin saves update those pages immediately (plus homepage + map).

## Business / claim page

`/for-business/` — claim & featured packages; form saves to D1 `submissions`.

## Next (planned)

- Venue-facing monthly reports from D1 aggregates
- One-click “apply submission → venue” from the admin inbox
- Email alerts on new submissions

