# Romlig Presse — Next.js shop

A port of the single-file Romlig Presse shop to **Next.js 15 (App Router) + React 19 + TypeScript**.
The visual design, catalogue and interactions are unchanged; the code is now split into
components and reads its data from one commerce seam so you can attach Shopify or Medusa.

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start
npm run typecheck    # tsc --noEmit
```

Requires Node 20.9+ (see `engines`). `npm run audit` should report **0 vulnerabilities**.

There is no ESLint setup in this project. `npm run typecheck` is the static check;
adding ESLint would pull in `fast-glob` → `micromatch` → `braces`, which carries
`GHSA-vfj7-8cjw-p6xm` (high, stack-exhaustion DoS, unfixed as of October 2026) and
would break the clean audit above.

## What changed from the single-file version

| Single file | Next.js |
|---|---|
| Inline `<style>` | `app/globals.css` (same tokens, class names kept) |
| Inline `<script>` | `components/*.tsx`, `lib/*.ts` |
| Hash router (`#/item/slug`) | Real routes: `/`, `/c/<cat>`, `/product/<slug>`, `/about`, `/page/<slug>` |
| `localStorage` cart + global `cart` | `CartProvider` context |
| Inline `onclick="add(1)"` | React state + events |
| `document.getElementById` lookups | Components and `useState` |

Behaviour is preserved: the catalogue grid, museum wall labels, crop-mark covers,
product overlay with prev/next pager, about/policy overlays, cart drawer with the
free-shipping meter, and the `localStorage` cart all work as before.

### The one deliberate difference

In the original, clicking a product opened an **overlay on top of the catalogue**.
That is still what the user sees — but it is now driven by a real URL
(`/product/threshold`) instead of a hash fragment. That means:

- product, category, about and policy pages are real, indexable URLs with their own metadata;
- back/forward and deep links work;
- an unknown slug renders a proper 404.

## Routes

| Path | What renders |
|---|---|
| `/` | Catalogue, all categories |
| `/c/books`, `/c/journals`, `/c/prints` | Catalogue filtered |
| `/product/<slug>` | Product overlay |
| `/about` | About overlay |
| `/page/shipping`, `/page/terms`, `/page/privacy` | Policy overlays |

The grid, overlays and cart drawer all live in `components/ShopClient.tsx`, which
derives its state from `usePathname()` — so the whole shop is one client surface over
real URLs.

## Attaching Shopify or Medusa

Everything the UI reads comes from **`lib/commerce.ts`**. Swap one env var and nothing
else changes:

```bash
# .env.local
NEXT_PUBLIC_COMMERCE_PROVIDER=shopify   # or medusa, or local
```

The value is validated at module load (`lib/provider.ts`). An unrecognised value
fails the build rather than silently serving the demo catalogue; only an
*unset* variable falls back to `local`.

### Shopify (Storefront API)

No SDK required — `lib/commerce.ts` posts a GraphQL query.

```bash
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=
```

Map in the adapter: `handle` → `slug`, `variants[0].price.amount` → `price`
(already major units, kept as-is), `!variants[0].availableForSale` → `sold`,
`variants[0].id` → `variantId`.

The request is pinned to `SHOPIFY_API_VERSION` in `lib/commerce.ts` — currently
`2026-10`, the latest stable. Shopify retires versions on a schedule, so bump
this quarterly after checking the
[versioning page](https://shopify.dev/docs/api/usage/versioning).

Note that a stale pin does **not** fail loudly: Shopify falls forward to the
oldest accessible stable version, so a forgotten bump can silently serve data
from a much older API. Check the constant when product data looks wrong, not
just when the build breaks.

**The store's currency must be USD.** The adapter compares every product's
`currencyCode` against `CURRENCY` in `lib/types.ts` and fails the build on a
mismatch, rather than rendering a foreign price as dollars.

The token needs the **`unauthenticated_read_product_listings`** scope to list
products and **`unauthenticated_write_checkouts`** to create a cart. A token
missing the second scope will list fine and then fail at checkout.

### Medusa v2

```bash
MEDUSA_BACKEND_URL=https://your-medusa.com
MEDUSA_PUBLISHABLE_KEY=pk_…
MEDUSA_REGION_ID=reg_…
```

`MEDUSA_REGION_ID` is required: Medusa resolves prices per region, so without
it the request falls back to the backend's default region and can return the
wrong currency or price list. Find it in Medusa Admin → Settings → Regions.
**It must be a region whose currency is USD** — the same currency check applies.

Map in the adapter: `metadata.slug` → `slug`,
`variants[0].calculated_price.calculated_amount` → `price`,
`manage_inventory && inventory_quantity <= 0 && !allow_backorder` → `sold`.

`lib/types.ts` defines the `Product` shape both backends are mapped onto.

**Prices are in US dollars (major units, may carry cents)**, matching the seed
data and `usd()` in `lib/format.ts`. Both backends already report major units —
Shopify's `price.amount` is a decimal string (`"420.00"`) and Medusa's
`calculated_amount` is a plain number (`420`) — so neither adapter multiplies or
divides. Note that Medusa **v1** used minor units (cents); v2 does not, and any
`/ 100` here is a bug.

Money is computed in integer cents (`toCents` in `lib/format.ts`) so a line total
never renders as `59.980000000000004`.

Neither adapter needs an SDK — both are plain `fetch`, so the app has no extra
runtime dependencies. When you switch, only that mapping and the generated cover
art need attention: the current `art: { bg, fg, shape }` is a stand-in until real
product images are wired in.

> Env vars are read only from `lib/commerce.ts`, which runs on the server. Never put a
> secret key in a `NEXT_PUBLIC_*` variable.

## Structure

```
app/
  layout.tsx              reads the catalogue, wraps CartProvider + ShopClient
  page.tsx                "/" — the catalogue
  c/[cat]/page.tsx        "/c/<category>"
  product/[slug]/page.tsx "/product/<slug>"  (SSG + metadata)
  about/page.tsx          "/about"
  page/[slug]/page.tsx    "/page/<policy>"
  api/checkout/route.ts   POST — builds a Shopify cart, returns a checkout URL
  globals.css
components/
  ShopClient.tsx          grid, overlays, cart wiring
  CartProvider.tsx        cart state + localStorage
  CartDrawer.tsx          slide-in cart
  CoverArt.tsx            generated SVG covers
  Nav.tsx                 category filter
lib/
  commerce.ts             ← swap providers here
  provider.ts             NEXT_PUBLIC_COMMERCE_PROVIDER, validated at load
  catalogue.ts            local fallback data + slugify
  content.ts              about + policy copy
  format.ts               prices, slugs, category lookup
  types.ts                Product, Policy, CartLine, CURRENCY
```

## Checkout

`POST /api/checkout` takes `{ lines: [{ id, qty }] }`, re-reads the catalogue
**uncached** (`listProducts({ revalidate: true })`), drops anything sold out or
unknown, and calls Shopify's `cartCreate` to return a `checkoutUrl`. The browser
redirects there and Shopify handles payment, taxes and shipping.

- Only `shopify` mode checks out. `local` keeps the demo behaviour (clears the
  cart, shows a thank-you) and the button is labelled `Checkout (demo)`.
- Because the cart lives in `localStorage`, it is re-validated server-side before
  the cart is created — a price or availability change is caught here rather than
  at payment.
- The cart is deliberately **not** cleared on redirect: a buyer who abandons the
  Shopify page and comes back still has their items. Clearing it after a
  confirmed order needs an order webhook, which is not implemented.
- The endpoint is unauthenticated (that is how headless Shopify checkout works)
  and spends your Storefront API rate limit on every call.

## Deploying (Vercel)

The pages build as static + SSG routes, and `/api/checkout` is a serverless
function — Vercel needs no extra config for either. After importing the repo, set
these in **Project → Settings → Environment Variables**:

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_COMMERCE_PROVIDER` | `local` | `shopify` / `medusa` / `local`. An unrecognised value fails the build. |
| `SHOPIFY_STORE_DOMAIN` | `your-store.myshopify.com` | Hostname only, no `https://`, no trailing slash. Server-side only. |
| `SHOPIFY_STOREFRONT_ACCESS_TOKEN` | *(paste the token)* | Server-side only — never prefix with `NEXT_PUBLIC_`. This is the **Storefront API** token, not the Admin API token; a `shpat_…` value will be rejected with 401. Needs `unauthenticated_read_product_listings` and `unauthenticated_write_checkouts`. |
| `MEDUSA_BACKEND_URL` | `https://your-medusa.com` | Server-side only. |
| `MEDUSA_PUBLISHABLE_KEY` | `pk_…` | Public by design. |
| `MEDUSA_REGION_ID` | `reg_…` | Required — prices are resolved per region, and it must be a **USD** region. From Medusa Admin → Settings → Regions. |

With only `NEXT_PUBLIC_COMMERCE_PROVIDER=local` set, the site deploys fully on
seed data. The provider is read at module load in `lib/provider.ts`, so the
choice is baked in at build time.

**Redeploy after changing env vars.** The provider is inlined into the build and
the catalogue is read during it, so changing an env var alone does nothing —
push a commit or trigger a redeploy.

If a real provider is selected and the backend is unreachable, misconfigured, or
returns a currency other than USD, `next build` **fails** rather than falling
back to the seed data. The seed catalogue is demo content with demo prices;
shipping it because a backend happened to be down at build time would put fake
products in front of real customers.

### How fresh is the catalogue?

Product requests are cached for 60 seconds (`revalidate: 60`, reported as
`Revalidate 1m` in the build output). A price or stock change in the backend
therefore shows up about a minute later, not at the next deploy. Verified
locally against a stubbed backend; Vercel's CDN adds its own `s-maxage`, so
confirm the timing there before relying on it.

### Verifying the deployment

- `/` lists 12 items; `/c/books`, `/c/journals`, `/c/prints` filter correctly.
- `/product/threshold` shows the overlay; an unknown slug returns 404.
- The cart persists across reloads (`localStorage`).
- With a real provider configured, **prices must match what you entered in the
  backend exactly**. Check a price you know, not just the shape of the string.
  Two failure modes look different and both mean the unit handling regressed:
  - **Too small** — `$3` for a `$300` product: a `/ 100` is still being applied to
    a price that is already in major units.
  - **Too large** — `$28000` for a `$280` product: the value was multiplied by
    100, or the backend was given the price in cents.
- Sold-out states appear only for variants that manage inventory, have zero
  stock, and do not allow backorders. If *nothing* ever shows as sold out, check
  the `fields` parameter on the products request (see `lib/commerce.ts`).
- With Shopify configured, add an item and check out against a test payment
  profile. Then mark a product unavailable in the backend and confirm
  `/api/checkout` returns `409 Some items are no longer available.` rather than
  creating a cart for it.

## Placeholders to replace before launch

- **Prices** — the seed catalogue is the original NOK figures divided by ten
  (`420` → `42`). Set real USD prices in the backend, not here.
- **Shipping** — `SHIPPING_FEE = 8` and `FREE_SHIPPING_OVER = 60` in
  `lib/types.ts` are guesses. The shipping copy in `lib/content.ts` is generated
  from these, so changing them updates the About and policy pages too.
- **Tax wording** — `lib/content.ts` currently reads "Sales tax, where
  applicable, is calculated at checkout", which is right for US customers. If you
  sell mainly into Norway or the EU, prices should include VAT and the wording
  must say so; consider Shopify Markets for local-currency display.
- **Organisation number** — the footer and Terms page still carry
  `Org. no. 000 000 000`.

## Dependencies

- `next` 15.5.28 — the latest patched 15.x (the 14.x line is end-of-life and still
  reports advisories up to 14.2.31, so a clean audit on 14.x is not possible).
- `react` / `react-dom` 19.1.1 — required by Next 15.
- `overrides.postcss` 8.5.31 — Next pins an old PostCSS internally; the override
  applies the patched version.

## Verified

`npx tsc --noEmit` clean, `npm run build` produces 23 static routes plus the
`/api/checkout` serverless route, `npm audit` reports 0 vulnerabilities.

The money path was tested by driving the real compiled adapters against fixtures:
`usd(42)` → `$42.00`; `toCents(0.1 + 0.2)` → `30`; `2 × $24.99` and `3 × $19.99`
produce exactly `49.98` and `59.97`; the free-shipping boundary is exact at
`$59.99` / `$60.00` / `$60.01`; a Shopify product priced in NOK fails the build;
a variant-less product is skipped rather than shown at `$0.00`; and
`revalidate: true` sends `cache: "no-store"` while the default sends
`next: { revalidate: 60 }`.

`POST /api/checkout` was exercised against a running server with a stubbed
Storefront API: 19 checks covering the happy path (correct `cartCreate` input —
variant GID plus quantity, and a catalogue re-read before the cart is created),
sold-out and unknown items (`409`), empty and malformed bodies (`400`), every
malformed quantity shape, a mixed valid+sold cart (`409`), and a product that
became available between page load and checkout.

Checked in a real browser in both `local` and `shopify` modes: grid renders 12
items (4 cols desktop / 2 cols mobile) with cents preserved (`$24.99`), category
filtering, product overlay with prev/next pager, about and policy overlays whose
close link returns to the category you came from, sold-out states, add-to-cart,
quantity steppers, free-shipping meter, `localStorage` persistence across reload,
a cart holding invalid quantities (`{1: 9999, 2: -5, 3: 2}`) collapsing to
`{"3":2}` instead of reaching the subtotal, Escape-to-close, and 404s for unknown
products and categories. The checkout button reads `Checkout (demo)` under
`local` and `Checkout` under `shopify`.

Three bugs were found and fixed during browser testing of the original port: the category
filter rendered an empty grid on a direct load (case mismatch + state sync), nav links
produced `/c/c/books` (relative hrefs), and Escape on an overlay navigated to `#/`
(a real page in Next).

