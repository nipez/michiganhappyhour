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
spots/              # Individual venue pages
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

## Analytics (GA4)

CTA tracking is live via `/js/cta-track.js` and homepage card handlers.

| Event | When it fires |
| --- | --- |
| `spot_view` | Spot detail page load |
| `cta_call` | Call button / tel link |
| `cta_map` | Map button / map pin |
| `cta_directions` | Directions / Google Maps link |
| `cta_details` | Details / View Details link |

Params include `spot_name`, `town`, `spot_id`, `page_type`, `source`.

In GA4: **Admin → Events → mark the `cta_*` events as Key events**.  
Then build an Explore report with rows = `spot_name`, values = event count.

## Next (planned)

- Supabase for venue data / submissions
- Incremental Cursor-driven updates instead of full zip re-uploads
