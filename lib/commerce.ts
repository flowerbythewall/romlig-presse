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
 *     env     MEDUSA_BACKEND_URL, MEDUSA_PUBLISHABLE_KEY
 *     price   variants[0].calculated_price.calculated_amount — MINOR units
 *             (28000 = NOK 280), so divide by 100
 *     sold    inventory_quantity === 0 && !allow_backorder
 *     slug    metadata.slug
 *
 * Prices are stored in MAJOR units (whole NOK), matching lib/format.ts and the
 * seed data, so every provider renders identically. The two backends disagree on
 * units — Shopify major, Medusa minor — and each adapter normalises to major.
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

function warn(msg: string) {
  console.warn(`${LOG_PREFIX} ${msg}`);
}

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
  // Never hard-fail the build over unset config: the shop should still render
  // (on seed data) so you can see it before wiring a backend up.
  warn(`Missing ${names.join(", ")} — ${action}. Falling back to the local seed data.`);
  throw new CommerceConfigError(names.join(", "));
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
    if (err instanceof CommerceConfigError) return BOOKS;
    // A real provider that failed should not take the shop down either —
    // degrade to seed data rather than returning an empty grid.
    warn(`Backend request failed: ${err instanceof Error ? err.message : String(err)}`);
    return BOOKS;
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
    // price.amount is a decimal string in MAJOR units ("420.00" = NOK 420).
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
  if (!base || !key) {
    missing(["MEDUSA_BACKEND_URL", "MEDUSA_PUBLISHABLE_KEY"], "the Medusa adapter needs them");
  }

  // `*variants` is required for inventory fields (manage_inventory,
  // inventory_quantity, allow_backorder) — without it the sold-out check below
  // has nothing to read. `*variants.calculated_price` adds the price.
  const res = await fetch(
    `${base}/store/products?limit=100&fields=*variants,*variants.calculated_price`,
    {
      headers: { "x-publishable-api-key": key },
      next: { revalidate: 60 },
    }
  );

  if (!res.ok) throw new Error(`Medusa store API error: ${res.status}`);
  const json = await res.json();

  return (json.products ?? []).map((p: any) => {
    const v = p.variants?.[0];
    // Medusa stores prices in the currency's minor units, so a NOK 280 item
    // arrives as 28000 — divide by 100 to match the storefront's major units.
    //
    // A price is treated as minor units only when it is an exact multiple of
    // 100 (which major-unit NOK prices essentially never are, since NOK has no
    // subunit). This keeps both shapes correct: 28000 -> 280, while 280 -> 280.
    const rawAmount = Number(
      v?.calculated_price?.calculated_amount ?? v?.prices?.[0]?.amount ?? 0
    );
    const price = rawAmount > 0 && rawAmount % 100 === 0 ? rawAmount / 100 : rawAmount;
    const rawCat = (p.metadata?.category ?? "").trim();
    const category = (CATEGORIES.find((c) => c.toLowerCase() === rawCat.toLowerCase()) ??
      "Books") as Product["category"];

    // Sold out is only true when the backend explicitly says so: a variant that
    // manages inventory, has zero stock, and does not allow backorders. Missing
    // inventory fields must NOT mark an item sold — otherwise every product with
    // inventory tracking disabled would show as unavailable.
    const managesInventory = v?.manage_inventory ?? p.manage_inventory ?? true;
    const stock = v?.inventory_quantity;
    const soldOut =
      managesInventory &&
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
