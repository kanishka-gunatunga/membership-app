# MemberPro

**Build, Manage, and Grow Memberships**

Shopify app that shows member prices on the storefront and applies member discounts at checkout for logged-in customers.

**Pricing:** $20/month with a 14-day free trial.

## Stack

- **Admin app** — React Router + Polaris web components
- **Discount function** — `extensions/member-pricing-discount`
- **Theme extension** — `extensions/member-pricing-theme`
- **App proxy** — `/apps/membership-pricing/prices` for collection card hydration
- **Database** — PostgreSQL (Prisma session storage + order analytics)

## Local development

```bash
npm install
shopify app config use membership-pricing   # if using named config
shopify app dev
```

Press **P** in the CLI to open the app. Install on your dev store when prompted.

### After pulling changes

```bash
npm run typecheck
npm run test
npm run lint
npx prisma migrate deploy   # production / shared DB only
```

## Merchant setup (dev store QA)

1. Open the app → **Save** settings (creates automatic discount + metaobject config).
2. Set **Member price** metafield on products (lower than regular price).
3. Optional: set **Campaign** = true for RRP strikethrough.
4. **Product page** — add **MemberPro pricing** block in theme editor.
5. **Product cards** — either:
   - **OS 2.0:** add **MemberPro pricing (card)** block + enable **Card pricing styles** app embed, or
   - **Dawn / legacy:** copy `member-pricing-card` snippet into theme + enable app embed.
6. **Cart** — add **MemberPro pricing (cart)** block or cart line snippet (logged-in customers only).

## Testing workflow

### Step 1 — Automated checks (every change)

```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

Build the discount function before deploy:

```bash
npm run build --workspace=member-pricing-discount
```

### Step 2 — Admin app

| Check | Expected |
|-------|----------|
| Install / open app | Loads settings page with MemberPro branding |
| First visit | Discount auto-created (or save manually) |
| Save settings | Success toast, discount active badge |
| App proxy test link | JSON with `products` and `labels` |
| Theme setup badges | Snippet status on legacy themes |

### Step 3 — Storefront display

| Surface | Guest | Logged-in customer |
|---------|-------|-------------------|
| PDP | Member + RRP display, login hint | Same display |
| Collection cards | RRP + member via proxy | Same |
| Campaign = true | Full RRP strikethrough | Same |

Hard-refresh after CSS/JS changes. Proxy responses cache ~60s.

### Step 4 — Checkout (critical)

1. Add member-priced product to cart as **guest** → pay regular price.
2. Log in with **customer account** → cart shows member discount.
3. Complete checkout → order shows **MemberPro** discount.
4. Multi-line cart → each eligible line discounted (function uses `ALL` strategy).

### Step 5 — Webhooks

```bash
shopify app webhook trigger --topic orders/paid
```

Verify `MemberOrderSnapshot` row created when order used **MemberPro** discount.

### Step 6 — Fresh install test

1. Uninstall app from dev store.
2. `shopify app deploy` (when ready for staging).
3. Reinstall on clean store.
4. Complete setup using only in-app instructions.

## Deploy

```bash
shopify app deploy
```

Host the web app (replace `example.com` in TOML). Run `prisma migrate deploy` on production database.

## App Store billing listing

Configure public pricing in **Partner Dashboard → Apps → MemberPro → Distribution → Manage listing → Pricing**:

| Field | Value |
|-------|-------|
| Plan type | Monthly recurring |
| Monthly charge | $20 USD |
| Free trial | 14 days |
| Welcome link | `/app` |

The app also requests billing via the Billing API on install (see `app/shopify.server.ts`). Listing pricing and API billing should match.

**Billing flow:** Shopify redirects to `/app/billing/callback` after charge approval. The callback waits for the subscription to become active (with retries) before opening the app, which prevents approve-plan redirect loops during review.

**Privacy policy:** Public URL at `/privacy` — set this in your App Store listing and configure `APP_SUPPORT_EMAIL` in production.

**Partner Dashboard → Distribution** must be set to **Public** (App Store) before the Billing API works in production.

Local dev **skips** billing by default. Set `SHOPIFY_BILLING_FORCE=true` to test charge approval locally (use a clean browser profile if you see HTTP 431).

Set `SHOPIFY_BILLING_SKIP=true` only in local development — it **cannot** be used in production (the app will fail to start).

Set `SHOPIFY_BILLING_TEST=true` in development to avoid real charges on non-dev stores.

### HTTP 431 on charge confirmation

`HTTP ERROR 431` on `confirm_recurring_application_charge` means **request headers are too large** (usually accumulated Shopify cookies from dev tunnels, Partner Dashboard, and multiple stores)—not missing permissions. Fix: clear cookies for `*.shopify.com` / `*.myshopify.com`, use an incognito window, or skip billing in local dev (default).

## Configuration

Canonical app config: `shopify.app.membership-pricing.toml`

Required scopes include `read_themes` (setup status) and metaobject scopes (function config sync).

### Order analytics webhook (optional, post-launch)

`orders/paid` is commented out in the TOML because it requires [Protected Customer Data](https://shopify.dev/docs/apps/launch/protected-customer-data) approval. After approval in Partner Dashboard, uncomment the webhook and add `read_orders` to scopes, then redeploy.

## Phase 1 behaviour

- Any **logged-in customer** = Level 1 member.
- **Variant** member price overrides **product** member price.
- **Campaign** affects display only (strikethrough RRP), not checkout logic.
