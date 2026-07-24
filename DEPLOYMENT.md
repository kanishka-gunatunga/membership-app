# MemberPro — production deployment guide

This app has **two deploy steps**:

1. **Host the web app** (Node server + PostgreSQL) — OAuth, admin UI, webhooks, app proxy.
2. **Deploy Shopify extensions** — discount function + theme extension (`shopify app deploy`).

Both must point at the same public app URL.

---

## Prerequisites

- [Shopify Partner account](https://partners.shopify.com) with app **MemberPro** created
- Production **PostgreSQL** database (Neon, Supabase, Railway, Fly Postgres, RDS, etc.)
- A host that runs Docker (or Node 20+) with **HTTPS**
- Domain or platform URL for the app (e.g. `https://memberpro.example.com`)

Recommended local verification before production:

```bash
npm run typecheck
npm run test
npm run lint
npm run build
npm run build --workspace=member-pricing-discount
```

---

## Step 1 — Provision PostgreSQL

Create a database and note the connection string:

```text
postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

On first deploy, migrations run automatically via:

```bash
npx prisma migrate deploy
```

(`npm run docker-start` runs this before starting the server.)

---

## Step 2 — Configure environment variables

Copy [`.env.example`](.env.example) and set these on your host:

| Variable | Required | Notes |
|----------|----------|--------|
| `SHOPIFY_API_KEY` | Yes | Partner Dashboard → App → Client ID |
| `SHOPIFY_API_SECRET` | Yes | Partner Dashboard → App → Client secret |
| `SHOPIFY_APP_URL` | Yes | Public HTTPS URL, **no trailing slash** |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SCOPES` | Yes | Must match TOML scopes (comma-separated) |
| `NODE_ENV` | Yes | `production` |
| `PORT` | Usually | Host sets this (default `3000`) |
| `APP_SUPPORT_EMAIL` | Recommended | Shown on `/privacy` |
| `SHOPIFY_BILLING_SKIP` | **Never in prod** | App throws on startup if set with `NODE_ENV=production` |
| `SHOPIFY_BILLING_TEST` | Optional | `false` in production billing tests on dev stores only |

Default scopes (from `shopify.app.membership-pricing.toml`):

```text
read_metaobjects,write_metaobjects,write_metaobject_definitions,read_products,write_products,write_discounts,read_themes
```

---

## Step 3 — Deploy the web app

### Option A — Docker (recommended)

Build and run:

```bash
docker build -t memberpro-app .
docker run -p 3000:3000 \
  -e SHOPIFY_API_KEY=... \
  -e SHOPIFY_API_SECRET=... \
  -e SHOPIFY_APP_URL=https://your-app.example.com \
  -e DATABASE_URL=postgresql://... \
  -e SCOPES=read_metaobjects,write_metaobjects,write_metaobject_definitions,read_products,write_products,write_discounts,read_themes \
  -e NODE_ENV=production \
  -e APP_SUPPORT_EMAIL=support@example.com \
  memberpro-app
```

Health check: `GET https://your-app.example.com/health` → `{"ok":true,...}`

### Option B — Node without Docker

```bash
npm ci
npx prisma generate
npm run build
npx prisma migrate deploy
npm run start
```

Use a process manager (systemd, PM2) and terminate TLS at your reverse proxy (nginx, Caddy, platform load balancer).

### Platform examples

| Platform | Notes |
|----------|--------|
| **Fly.io** | `fly launch`, set secrets, deploy Dockerfile |
| **Railway** | Connect repo, add Postgres plugin, set env vars |
| **Render** | Web service + managed Postgres, Docker or Node build |
| **Google Cloud Run** | Deploy container, Cloud SQL for Postgres |

Requirements for any platform:

- HTTPS on the public URL
- Persistent Postgres (not SQLite)
- Env vars from Step 2

---

## Step 4 — Update Shopify app URLs

Edit [`shopify.app.membership-pricing.toml`](shopify.app.membership-pricing.toml):

```toml
application_url = "https://your-app.example.com"

[auth]
redirect_urls = [ "https://your-app.example.com/auth/callback" ]

[app_proxy]
url = "https://your-app.example.com"
subpath = "membership-pricing"
prefix = "apps"
```

Deploy extensions + register URLs with Shopify:

```bash
shopify app config use membership-pricing
shopify app deploy
```

Confirm in **Partner Dashboard → Apps → MemberPro → Configuration**:

- App URL
- Allowed redirection URL(s)
- App proxy subpath `membership-pricing`

---

## Step 5 — Partner Dashboard (billing & listing)

Before production billing works:

1. **Distribution** → set to **Public** (App Store) or your chosen distribution model.
2. **Pricing** → $20/month, 14-day trial (must match `billing.shared.ts`).
3. **App listing** → Privacy policy URL: `https://your-app.example.com/privacy`
4. Set `APP_SUPPORT_EMAIL` in production env.

Billing behaviour:

- **Production** (`NODE_ENV=production`): charge required on install/open.
- Callback: `/app/billing/callback` (handles approve/decline + retries).
- Do **not** set `SHOPIFY_BILLING_SKIP` in production.

---

## Step 6 — Production test checklist

Use a **development store** first, then a clean store for a full install test.

### A. Health & auth

- [ ] `GET /health` returns 200
- [ ] `GET /` shows MemberPro landing / install link
- [ ] Install app on dev store → OAuth completes → embedded admin loads

### B. Admin app

- [ ] Save settings → success toast, discount active
- [ ] Linked metafields or app-managed fields work
- [ ] Theme setup links open theme editor

### C. Storefront

- [ ] Product page block shows member + RRP
- [ ] Collection cards show pricing (snippet or card block + app embed)
- [ ] Guest: display only; logged-in customer: checkout discount

### D. App proxy (fallback / dynamic cards)

- [ ] `https://STORE.myshopify.com/apps/membership-pricing/prices?handles=PRODUCT_HANDLE` returns JSON

### E. Billing

- [ ] Fresh install prompts for $20/month plan (14-day trial)
- [ ] Approve charge → lands in app (no redirect loop)
- [ ] Decline charge → `/app/billing` decline state
- [ ] `app_subscriptions/update` webhook registered (check Partner Dashboard or logs)

### F. Uninstall

- [ ] Uninstall app from store
- [ ] `app/uninstalled` webhook fires (session cleaned in DB)
- [ ] Reinstall works cleanly

### G. Compliance webhooks

Shopify sends test payloads for:

- `customers/data_request`
- `customers/redact`
- `shop/redact`

Endpoint: `/webhooks/compliance`

---

## Step 7 — Ongoing operations

| Task | Command / action |
|------|------------------|
| Extension updates | `shopify app deploy` |
| Web app code updates | Rebuild + redeploy container / platform |
| DB migrations | `npx prisma migrate deploy` (automatic in `docker-start`) |
| Logs | Monitor host logs for webhook and billing errors |
| Rollback | Redeploy previous container image; extensions versioned in Partner Dashboard |

---

## Common issues

| Symptom | Fix |
|---------|-----|
| OAuth redirect mismatch | `SHOPIFY_APP_URL` and TOML `redirect_urls` must match exactly (HTTPS) |
| App proxy 404 | TOML `[app_proxy]` URL + `shopify app deploy`; path `/apps/membership-pricing/prices` |
| Billing loop | Use `/app/billing/callback`; clear Shopify cookies or incognito |
| `SHOPIFY_BILLING_SKIP` crash | Remove from production env |
| Database errors | Check `DATABASE_URL`, SSL mode, migrations applied |
| Discount not applying | Redeploy extensions; Save settings in admin; customer must be logged in |
| Slow dev proxy | Expected with CLI tunnel; production hosting is faster |

---

## Architecture summary

```text
Merchant browser
    → Shopify Admin (embedded app) → your-app.example.com (Node + React Router)
    → PostgreSQL (sessions, optional order analytics)

Storefront
    → Theme Liquid (PDP + cards, instant)
    → App proxy (optional card fallback) → your-app.example.com/prices

Checkout
    → MemberPro discount function (Shopify-hosted, deployed via CLI)
```

---

## Quick reference

```bash
# 1. Deploy web app to your host (Docker or Node)

# 2. Migrate DB (if not using docker-start)
npx prisma migrate deploy

# 3. Deploy Shopify extensions + URLs
shopify app config use membership-pricing
shopify app deploy

# 4. Install on test store from Partner Dashboard
```

For local development, keep using `shopify app dev` and `.env` (not production `DATABASE_URL` unless intentional).
