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
adding ESLint would pull in `fast-glob` → `micromatch` → `braces`, which currently
has an unfixed high-severity advisory and would break the clean audit above.

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

### Shopify (Storefront API)

No SDK required — `lib/commerce.ts` posts a GraphQL query.

```bash
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=
```

Map in the adapter: `handle` → `slug`, `variants[0].price.amount` → `price`
(already major units, kept as-is), `!variants[0].availableForSale` → `sold`.

### Medusa v2

```bash
MEDUSA_BACKEND_URL=https://your-medusa.com
MEDUSA_PUBLISHABLE_KEY=pk_…
MEDUSA_REGION_ID=reg_…
```

`MEDUSA_REGION_ID` is required: Medusa resolves prices per region, so without
it the request falls back to the backend's default region and can return the
wrong currency or price list. Find it in Medusa Admin → Settings → Regions.

Map in the adapter: `metadata.slug` → `slug`,
`variants[0].calculated_price.calculated_amount` → `price`,
`manage_inventory && inventory_quantity <= 0 && !allow_backorder` → `sold`.

`lib/types.ts` defines the `Product` shape both backends are mapped onto.

**Prices are in major units (whole NOK)**, matching the seed data and `kr()` in
`lib/format.ts`. Both backends already report major units — Shopify's
`price.amount` is a decimal string (`"420.00"`) and Medusa's `calculated_amount`
is a plain number (`420`) — so neither adapter multiplies or divides. Note that
Medusa **v1** used minor units (cents); v2 does not, and any `/ 100` here is a
bug.

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
  globals.css
components/
  ShopClient.tsx          grid, overlays, cart wiring
  CartProvider.tsx        cart state + localStorage
  CartDrawer.tsx          slide-in cart
  CoverArt.tsx            generated SVG covers
  Nav.tsx                 category filter
lib/
  commerce.ts             ← swap providers here
  catalogue.ts            local fallback data + slugify
  content.ts              about + policy copy
  format.ts               prices, slugs, category lookup
  types.ts                Product, Policy, CartLine
```

## Deploying (Vercel)

The app builds as static + SSG routes, so Vercel needs no extra config. After
importing the repo, set these in **Project → Settings → Environment Variables**:

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_COMMERCE_PROVIDER` | `local` | Change to `shopify` / `medusa` once the backend is ready. Must be set before `next build` — see below. |
| `SHOPIFY_STORE_DOMAIN` | `your-store.myshopify.com` | Hostname only, no `https://`, no trailing slash. Server-side only. |
| `SHOPIFY_STOREFRONT_ACCESS_TOKEN` | *(paste the token)* | Server-side only — never prefix with `NEXT_PUBLIC_`. This is the **Storefront API** token, not the Admin API token; a `shpat_…` value will be rejected with 401. |
| `MEDUSA_BACKEND_URL` | `https://your-medusa.com` | Server-side only. |
| `MEDUSA_PUBLISHABLE_KEY` | `pk_…` | Public by design. |
| `MEDUSA_REGION_ID` | `reg_…` | Required — prices are resolved per region. From Medusa Admin → Settings → Regions. |

With only `NEXT_PUBLIC_COMMERCE_PROVIDER=local` set, the site deploys fully on
seed data. The provider is read at module load in `lib/commerce.ts` (a server-only
module), and every route is statically generated, so the provider choice is baked
in at build time.

**Redeploy after changing env vars.** All routes are statically generated, so the
catalogue is read during `next build` and the result is frozen into the deploy.
Changing an env var alone does nothing — push a commit or trigger a redeploy.

If a real provider is selected and the backend is unreachable or misconfigured,
`next build` **fails** rather than falling back to the seed data. The seed
catalogue is demo content with demo prices; shipping it because a backend happened
to be down at build time would put fake products in front of real customers.

### Verifying the deployment

- `/` lists 12 items; `/c/books`, `/c/journals`, `/c/prints` filter correctly.
- `/product/threshold` shows the overlay; an unknown slug returns 404.
- The cart persists across reloads (`localStorage`).
- With a real provider configured, **prices must match what you entered in the
  backend exactly**. Check a price you know, not just the shape of the string.
  Two failure modes look different and both mean the unit conversion regressed:
  - **Too small** — `NOK 3` for a `NOK 300` product: a `/ 100` is still being
    applied to a price that is already in major units.
  - **Too large** — `NOK 28000` for a `NOK 280` product: the raw value was shown
    without the conversion the backend actually needs.
- Sold-out states appear only for variants that manage inventory, have zero
  stock, and do not allow backorders. If *nothing* ever shows as sold out, check
  the `fields` parameter on the products request (see `lib/commerce.ts`).

## Dependencies

- `next` 15.5.28 — the latest patched 15.x (the 14.x line is end-of-life and still
  reports advisories up to 14.2.31, so a clean audit on 14.x is not possible).
- `react` / `react-dom` 19.1.1 — required by Next 15.
- `overrides.postcss` 8.5.31 — Next pins an old PostCSS internally; the override
  applies the patched version.

## Verified

`npx tsc --noEmit` clean, `npm run build` produces 23 static routes, `npm audit` reports
0 vulnerabilities. Checked in a real browser at 1440×900 and 390×844: grid renders
12 items (4 cols desktop / 2 cols mobile), category filtering, product overlay with
prev/next pager, about and policy overlays, sold-out states, add-to-cart, quantity
steppers, free-shipping meter, checkout clearing the cart, `localStorage` persistence
across reload, Escape-to-close, focus moving into the overlay, and 404s for unknown
products and categories.

Three bugs were found and fixed during browser testing of the original port: the category
filter rendered an empty grid on a direct load (case mismatch + state sync), nav links
produced `/c/c/books` (relative hrefs), and Escape on an overlay navigated to `#/`
(a real page in Next).

