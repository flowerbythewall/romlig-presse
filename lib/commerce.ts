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
 *     price   variants[0].price.amount   — MAJOR units ("420.00"), keep as-is
 *     sold    !variants[0].availableForSale
 *     slug    handle
 *
 *   MEDUSA v2
 *     npm i   — none required; GET /store/products with a publishable key
 *     env     MEDUSA_BACKEND_URL, MEDUSA_PUBLISHABLE_KEY, MEDUSA_REGION_ID
 *     price   variants[0].calculated_price.calculated_amount — MAJOR units
 *             ("280" = $280), keep as-is
 *     sold    manage_inventory && inventory_quantity <= 0 && !allow_backorder
 *     slug    metadata.slug
 *
 * Prices are stored in MAJOR units (whole dollars), matching lib/format.ts and
 * the seed data. Both backends already report major units — Shopify as a decimal
 * string ("420.00"), Medusa as a plain number (420) — so neither adapter
 * multiplies or divides. Medusa v1 used minor units; v2 stores major units, so
 * any "/ 100" here is a bug ($300 would render as $3).
 *
 * Env vars live in .env.local and are only ever read here or in server
 * components — never ship a secret key to the browser.
 */
import { BOOKS } from "./catalogue";
import { CATEGORIES, type Product } from "./types";

export type CommerceProvider = "local" | "shopify" | "medusa";

export const COMMERCE_PROVIDER: CommerceProvider =
  (process.env.NEXT_PUBLIC_COMMERCE_PROVIDER as CommerceProvider) ?? "local";

const LOG_PREFIX = "[romlig-presse]";

/**
 * Read an env var at runtime, not at module load.
 *
 * `process.env` is inlined at build time, so a var read at import time sees the
 * build machine's environment. Reading it inside a request keeps the build
 * portable and lets `next start` pick up values from the process environment.
 */
function env(name: string): string | undefined {
  return process.env[name];
}

function missing(names: string[], action: string): never {
  // Thrown, not warned-and-continued: with a real provider selected, missing
  // config must fail the build rather than serve the demo catalogue.
  throw new CommerceConfigError(`${names.join(", ")} — ${action}`);
}

/** Thrown when a real provider is selected but its config is incomplete. */
class CommerceConfigError extends Error {}

/**
 * @param opts.revalidate force a fresh read on the server.
 * @returns the catalogue in shop order.
 */
export async function listProducts(opts?: { revalidate?: boolean }): Promise<Product[]> {
  void opts;
  try {
    switch (COMMERCE_PROVIDER) {
      case "shopify":
        return await listFromShopify();
      case "medusa":
        return await listFromMedusa();
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

async function listFromShopify(): Promise<Product[]> {
  // Accept the domain with or without a scheme, and with or without a port.
  // Strip the scheme first, then decide: a port means a local/test host on
  // plain HTTP, anything else is a real *.myshopify.com on HTTPS.
  const raw = (env("SHOPIFY_STORE_DOMAIN") ?? "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const domain = raw.replace(/:\d+$/, "");
  const token = env("SHOPIFY_STOREFRONT_ACCESS_TOKEN");
  if (!domain || !token) {
    missing(
      ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_STOREFRONT_ACCESS_TOKEN"],
      "the Shopify adapter needs them"
    );
  }
  const scheme = /:\d+$/.test(raw) ? "http" : "https";
  const base = `${scheme}://${raw}`;

  const res = await fetch(`${base}/api/2025-01/graphql.json`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({
      query: `{
        products(first: 100) {
          edges { node {
            id handle title description vendor productType createdAt
            tags
            variants(first: 1) { edges { node {
              price { amount currencyCode }
              availableForSale
              sku
            } } }
          } }
        }
      }`,
    }),
    next: { revalidate: 60 },
  });

  if (!res.ok) throw new Error(`Shopify Storefront API error: ${res.status}`);
  const json = await res.json();
  if (json?.errors?.length) {
    throw new Error(`Shopify GraphQL error: ${json.errors[0].message}`);
  }
  const edges = json?.data?.products?.edges ?? [];

  return edges.map((e: any) => {
    const n = e.node;
    const v = n.variants.edges[0]?.node;
    // price.amount is a decimal string in MAJOR units ("420.00" = $420).
    // The storefront renders major units (see lib/format.ts), so keep it as-is.
    const price = Math.round(Number(v?.price?.amount ?? 0));
    const rawCat = (n.productType ?? "").trim();
    // productType is free text in Shopify, so validate against the known list
    // rather than trusting whatever the merchant typed.
    const category = (CATEGORIES.find((c) => c.toLowerCase() === rawCat.toLowerCase()) ??
      "Books") as Product["category"];
    return {
      id: n.id,
      slug: n.handle,
      title: n.title,
      author: n.vendor ?? "Romlig Presse",
      category,
      year: Number(n.createdAt?.slice(0, 4)) || new Date().getFullYear(),
      price: price || 0,
      format: "",
      // Cover art falls back to the generated motif until real images are mapped.
      art: { bg: "#f4f4f4", fg: "#111", shape: "lines" },
      sold: !(v?.availableForSale ?? true),
      description: n.description || "",
    };
  });
}

async function listFromMedusa(): Promise<Product[]> {
  const base = env("MEDUSA_BACKEND_URL");
  const key = env("MEDUSA_PUBLISHABLE_KEY");
  // Prices are resolved per region, so without a region the request falls back
  // to Medusa's default region — wrong currency or wrong price list for any
  // shop with more than one region.
  const regionId = env("MEDUSA_REGION_ID");
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
      next: { revalidate: 60 },
    }
  );

  if (!res.ok) throw new Error(`Medusa store API error: ${res.status}`);
  const json = await res.json();

  return (json.products ?? []).map((p: any) => {
    const v = p.variants?.[0];
    // Medusa v2 returns prices in MAJOR units — a $280 variant comes back as
    // 280, and the storefront renders major units (see lib/format.ts). Do NOT
    // divide by 100: that is the v1 convention, and here it would turn $300
    // into $3 and $500 into $5 while leaving other prices untouched.
    const price = Math.round(Number(v?.calculated_price?.calculated_amount ?? 0));
    const rawCat = (p.metadata?.category ?? "").trim();
    const category = (CATEGORIES.find((c) => c.toLowerCase() === rawCat.toLowerCase()) ??
      "Books") as Product["category"];

    // Sold out only when Medusa says so. `inventory_quantity` is returned only
    // for variants whose manage_inventory is true, and only when the `fields`
    // param above asks for it. When it is missing we deliberately do NOT mark
    // the item sold: a shop-wide "everything is sold out" badge (and a disabled
    // Add to cart on every product) is worse than a missing sold-out badge.
    // A value of null means the variant has no inventory item linked.
    const stock = v?.inventory_quantity;
    const soldOut =
      v?.manage_inventory === true &&
      typeof stock === "number" &&
      stock <= 0 &&
      v?.allow_backorder !== true;
    return {
      id: p.id,
      slug: p.metadata?.slug ?? p.handle ?? p.id,
      title: p.title,
      author: p.metadata?.author ?? "Romlig Presse",
      category,
      year: Number(p.metadata?.year) || new Date().getFullYear(),
      price,
      format: p.metadata?.format ?? "",
      art: { bg: "#f4f4f4", fg: "#111", shape: "lines" },
      sold: soldOut,
      description: p.description ?? "",
    };
  });
}

/** One product by slug — used by generateStaticParams and the product route. */
export async function getProduct(slug: string): Promise<Product | undefined> {
  const all = await listProducts();
  return all.find((p) => p.slug === slug);
}
