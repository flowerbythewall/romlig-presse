/**
 * Single source of truth for everything the storefront reads.
 *
 * Today the data is the local catalogue in lib/catalogue.ts. To move to a real
 * commerce backend, implement `listProducts` below and leave the rest of the app
 * alone — the Product shape in lib/types.ts is modelled on both the Shopify
 * Storefront API and Medusa v2, so an adapter only maps fields.
 *
 *   SHOPIFY (Storefront API, no SDK needed)
 *     npm i   — none required; POST to /api/<version>/graphql.json
 *     env     SHOPIFY_STORE_DOMAIN, SHOPIFY_STOREFRONT_ACCESS_TOKEN
 *     api     2026-10 (latest stable — bump quarterly, see SHOPIFY_API_VERSION)
 *     price   variants[0].price.amount   — MAJOR units ("420.00"), keep as-is
 *     sold    !variants[0].availableForSale
 *     slug    handle
 *     variant variants[0].id             — needed to build a checkout cart
 *
 *   MEDUSA v2
 *     npm i   — none required; GET /store/products with a publishable key
 *     env     MEDUSA_BACKEND_URL, MEDUSA_PUBLISHABLE_KEY, MEDUSA_REGION_ID
 *     price   variants[0].calculated_price.calculated_amount — MAJOR units
 *             ("280" = $280), keep as-is
 *     sold    manage_inventory && inventory_quantity <= 0 && !allow_backorder
 *     slug    metadata.slug
 *
 * Prices are stored in MAJOR units (dollars, possibly with cents), matching
 * lib/format.ts and the seed data. Both backends already report major units —
 * Shopify as a decimal string ("420.00"), Medusa as a plain number (420) — so
 * neither adapter multiplies or divides. Medusa v1 used minor units; v2 stores
 * major units, so any "/ 100" here is a bug ($300 would render as $3).
 *
 * Env vars live in .env.local and are only ever read here or in server
 * components — never ship a secret key to the browser.
 */
import { BOOKS } from "./catalogue";
import { COMMERCE_PROVIDER } from "./provider";
import { CATEGORIES, CURRENCY, type Product } from "./types";

export { COMMERCE_PROVIDER };
export type { CommerceProvider } from "./provider";

const LOG_PREFIX = "[romlig-presse]";

/**
 * Shopify retires API versions on a schedule. 2026-10 is the latest stable as
 * of October 2026; bump this each quarter after checking
 * https://shopify.dev/docs/api/usage/versioning
 */
const SHOPIFY_API_VERSION = "2026-10";

function missing(names: string[], action: string): never {
  // Thrown, not warned-and-continued: with a real provider selected, missing
  // config must fail the build rather than serve the demo catalogue.
  throw new Error(`Missing ${names.join(", ")} — ${action}`);
}

/** Parse a major-unit price, keeping cents. */
function toPrice(raw: unknown, where: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${LOG_PREFIX} Invalid price ${String(raw)} for ${where}`);
  }
  return n;
}

/**
 * Both backends report prices in the shop's own currency, so a currency we do
 * not sell in means the request hit the wrong region or the wrong store. That is
 * a config bug, not something to paper over by rendering a foreign price.
 *
 * Absent currency is tolerated: a product with no variant is skipped before this
 * runs, and some Medusa deployments omit the field.
 */
function assertCurrency(code: unknown, where: string) {
  if (code && String(code).toUpperCase() !== CURRENCY) {
    throw new Error(`${LOG_PREFIX} ${where} is priced in ${String(code)}, expected ${CURRENCY}`);
  }
}

/**
 * Next's fetch cache options. `next: { revalidate: 60 }` makes the catalogue
 * refresh about a minute after a backend change (and shows up as `Revalidate 1m`
 * in the build report); `cache: "no-store"` bypasses it, which the checkout
 * route needs so it can re-validate the cart against current prices.
 */
type FetchInit = RequestInit & { next?: { revalidate: number } };

function fetchInit(fresh: boolean): FetchInit {
  const init: FetchInit = fresh ? { cache: "no-store" } : { next: { revalidate: 60 } };
  return init;
}

/**
 * @param opts.revalidate bypass the 60s cache and read the backend now. Only the
 *   checkout route needs this — pages are fine with the cached catalogue.
 * @returns the catalogue in shop order.
 */
export async function listProducts(opts?: { revalidate?: boolean }): Promise<Product[]> {
  try {
    switch (COMMERCE_PROVIDER) {
      case "shopify":
        return await listFromShopify(opts?.revalidate ?? false);
      case "medusa":
        return await listFromMedusa(opts?.revalidate ?? false);
      default:
        return BOOKS;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // With a real provider configured, silently serving the demo catalogue is
    // the worst outcome: every route is statically generated at build time, so a
    // backend that was merely down during `next build` would ship fake products
    // at fake prices with nothing but a warning in the build log. Fail the build
    // instead — a deploy that cannot be trusted must not go out.
    //
    // `local` never reaches this branch (it returns BOOKS above), so there is no
    // seed-data fallback to preserve here.
    throw new Error(
      `${LOG_PREFIX} Provider "${COMMERCE_PROVIDER}" is misconfigured or unreachable; refusing to build the shop from the local seed data. ${msg}`
    );
  }
}

/**
 * One Storefront API call. Shared by the catalogue and the checkout route, so
 * the endpoint, version and headers stay in one place.
 */
export async function shopifyFetch<T = any>(
  query: string,
  variables?: object,
  fresh = false
): Promise<T> {
  // Accept the domain with or without a scheme, and with or without a port.
  // Strip the scheme first, then decide: a port means a local/test host on
  // plain HTTP, anything else is a real *.myshopify.com on HTTPS.
  const raw = (process.env.SHOPIFY_STORE_DOMAIN ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  const domain = raw.replace(/:\d+$/, "");
  const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
  if (!domain || !token) {
    missing(
      ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_STOREFRONT_ACCESS_TOKEN"],
      "the Shopify adapter needs them"
    );
  }
  const scheme = /:\d+$/.test(raw) ? "http" : "https";

  const res = await fetch(`${scheme}://${raw}/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    ...fetchInit(fresh),
  });

  if (!res.ok) throw new Error(`Shopify Storefront API error: ${res.status}`);
  const json = await res.json();
  if (json?.errors?.length) {
    throw new Error(`Shopify GraphQL error: ${json.errors[0].message}`);
  }
  return json.data as T;
}

async function listFromShopify(fresh: boolean): Promise<Product[]> {
  const data = await shopifyFetch<{
    products?: { edges?: { node: any }[] };
  }>(
    `{
      products(first: 100) {
        edges { node {
          id handle title description vendor productType createdAt
          variants(first: 1) { edges { node {
            id
            price { amount currencyCode }
            availableForSale
          } } }
        } }
      }
    }`,
    undefined,
    fresh
  );

  return (data?.products?.edges ?? [])
    .map((e): Product | null => {
      const n = e.node;
      const v = n.variants?.edges?.[0]?.node;

      // A product with no variant is not purchasable. Rendering it at $0.00
      // would let a customer add a free book to the cart, so drop it.
      if (!v?.id) {
        console.warn(`${LOG_PREFIX} "${n.handle}" has no variant — skipped.`);
        return null;
      }

      assertCurrency(v.price?.currencyCode, `Shopify product "${n.handle}"`);

      const rawCat = (n.productType ?? "").trim();
      const category = CATEGORIES.find((c) => c.toLowerCase() === rawCat.toLowerCase());
      if (!category) {
        console.warn(
          `${LOG_PREFIX} "${n.handle}" has productType "${rawCat}" — filed under Books.`
        );
      }

      return {
        id: n.id,
        variantId: v.id,
        slug: n.handle,
        title: n.title,
        author: n.vendor ?? "Romlig Presse",
        category: category ?? "Books",
        year: Number(n.createdAt?.slice(0, 4)) || new Date().getFullYear(),
        price: toPrice(v.price?.amount ?? 0, `Shopify product "${n.handle}"`),
        format: "",
        // Cover art falls back to the generated motif until real images are mapped.
        art: { bg: "#f4f4f4", fg: "#111", shape: "lines" },
        sold: !v.availableForSale,
        description: n.description || "",
      } satisfies Product;
    })
    .filter((p): p is Product => p !== null);
}

async function listFromMedusa(fresh: boolean): Promise<Product[]> {
  const base = process.env.MEDUSA_BACKEND_URL;
  const key = process.env.MEDUSA_PUBLISHABLE_KEY;
  // Prices are resolved per region, so without a region the request falls back
  // to Medusa's default region — wrong currency or wrong price list for any
  // shop with more than one region.
  const regionId = process.env.MEDUSA_REGION_ID;
  if (!base || !key || !regionId) {
    missing(
      ["MEDUSA_BACKEND_URL", "MEDUSA_PUBLISHABLE_KEY", "MEDUSA_REGION_ID"],
      "the Medusa adapter needs them"
    );
  }

  // `*variants.calculated_price` is the documented form: the leading `*` brings
  // in the variant's own fields (manage_inventory, allow_backorder) and
  // calculated_price adds the price for the region. `+variants.inventory_quantity`
  // adds stock — it is NOT part of the default fields, so without it
  // `inventory_quantity` is absent and nothing can ever be marked sold.
  const res = await fetch(
    `${base}/store/products?limit=100&region_id=${regionId}&fields=*variants.calculated_price,+variants.inventory_quantity`,
    {
      headers: { "x-publishable-api-key": key },
      ...fetchInit(fresh),
    }
  );

  if (!res.ok) throw new Error(`Medusa store API error: ${res.status}`);
  const json = await res.json();

  return (json.products ?? [])
    .map((p: any): Product | null => {
      const v = p.variants?.[0];
      const where = `Medusa product "${p.handle ?? p.id}"`;

      if (!v) {
        console.warn(`${LOG_PREFIX} ${where} has no variant — skipped.`);
        return null;
      }

      assertCurrency(v.calculated_price?.currency_code, where);

      const rawCat = (p.metadata?.category ?? "").trim();
      const category = CATEGORIES.find((c) => c.toLowerCase() === rawCat.toLowerCase());
      if (!category) {
        console.warn(`${LOG_PREFIX} ${where} has category "${rawCat}" — filed under Books.`);
      }

      // Medusa v2 returns prices in MAJOR units — a $280 variant comes back as
      // 280, and the storefront renders major units (see lib/format.ts). Do NOT
      // divide by 100: that is the v1 convention, and here it would turn $300
      // into $3 and $500 into $5 while leaving other prices untouched.
      const price = toPrice(v.calculated_price?.calculated_amount ?? 0, where);

      // Sold out only when Medusa says so. `inventory_quantity` is returned only
      // for variants whose manage_inventory is true, and only when the `fields`
      // param above asks for it. When it is missing we deliberately do NOT mark
      // the item sold: a shop-wide "everything is sold out" badge (and a disabled
      // Add to cart on every product) is worse than a missing sold-out badge.
      // A value of null means the variant has no inventory item linked.
      const stock = v.inventory_quantity;
      const soldOut =
        v.manage_inventory === true &&
        typeof stock === "number" &&
        stock <= 0 &&
        v.allow_backorder !== true;

      return {
        id: p.id,
        slug: p.metadata?.slug ?? p.handle ?? p.id,
        title: p.title,
        author: p.metadata?.author ?? "Romlig Presse",
        category: category ?? "Books",
        year: Number(p.metadata?.year) || new Date().getFullYear(),
        price,
        format: p.metadata?.format ?? "",
        art: { bg: "#f4f4f4", fg: "#111", shape: "lines" },
        sold: soldOut,
        description: p.description ?? "",
      } satisfies Product;
    })
    .filter((p: Product | null): p is Product => p !== null);
}

/** One product by slug — used by generateStaticParams and the product route. */
export async function getProduct(slug: string): Promise<Product | undefined> {
  const all = await listProducts();
  return all.find((p) => p.slug === slug);
}
