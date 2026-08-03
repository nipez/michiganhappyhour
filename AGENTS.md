# AGENTS.md

## Cursor Cloud specific instructions

This repo is the **Michigan Happy Hour** site: a static site (HTML at the repo root:
`index.html`, `regions/`, `spots/`, `blog/`, `map/`, `admin/`, etc.) served by **Cloudflare
Pages**, plus **Pages Functions** in `functions/` (the `/api/*` endpoints and live-rendered
`/spots/*` detail pages) backed by a **Cloudflare D1** database. There is no build step and no
framework — `wrangler pages dev .` serves the root directory directly.

There is **no lint config and no automated test suite** in this repo (no `lint`/`test` scripts,
no ESLint/Vitest/Jest config). Don't expect `npm test`/`npm run lint` to exist. See `package.json`
for the full script list and the `README.md` for deploy/D1 details.

### Running locally (dev)

The `npm install` dependency refresh is handled automatically by the Cloud environment update
script, so you don't need to run it manually. Before the dev server is useful you must have a
**local D1 database** with schema + seed data. These commands are idempotent and safe to re-run:

```bash
npm run db:migrate:local        # apply migrations to the local D1 (in .wrangler/)
npm run db:seed-venues:local    # seed ~180 venues into the local `venues` table
npm run dev                     # wrangler pages dev . -> http://localhost:8788
```

Non-obvious caveats:

- Local D1 state lives in the git-ignored `.wrangler/` directory. If that directory is absent
  (fresh checkout / not captured in the snapshot), the API endpoints return errors like
  `venues table missing` until you re-run the migrate + seed commands above. Re-running them is
  harmless (migrations use `IF NOT EXISTS`; the seed does `DELETE FROM venues` then re-inserts).
- The dev server binds `env.DB` to the **local** D1 automatically — no Cloudflare login or
  `CLOUDFLARE_API_TOKEN` is needed for local development. Login/tokens are only for `--remote`
  D1 operations and `npm run deploy`, which are production actions you should not run.
- `npm run db:seed-venues:local` reads venue data by parsing `const L=[...]` out of `index.html`
  and `var SPOTS = ...` out of `map/index.html`, so the seed depends on those literals staying
  intact in the HTML.

### Smoke-testing the app

```bash
# Homepage + a live-rendered spot page (both should be HTTP 200):
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8788/
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8788/spots/the-little-fleet-traverse-city

# Analytics write + read (dual-writes to D1; GA4 is only live in prod):
curl -s -X POST http://127.0.0.1:8788/api/track -H 'content-type: application/json' \
  -d '{"event_name":"cta_directions","spot_name":"The Little Fleet","town":"Traverse City"}'
curl -s http://127.0.0.1:8788/api/venues?format=list   # public venue JSON from D1
curl -s http://127.0.0.1:8788/api/stats                # aggregated event/venue stats
```

### Admin (optional)

`/admin/` (venues CRUD, reports, submissions inbox) is gated by an `ADMIN_PASSWORD`. It is not
required for the core public site to work; set it via a `.dev.vars` file (git-ignored) if you
need to exercise admin endpoints locally.
