/**
 * Romlig Presse — domain types.
 *
 * The local catalogue below is the fallback dataset used until a commerce
 * backend (Shopify Storefront API or Medusa) is wired in via lib/commerce.
 * Every shape mirrors what those backends return so swapping is a one-file change.
 */

export type Category = "Books" | "Journals" | "Prints";

/** A commerce-agnostic product record. */
export type Product = {
  id: string;
  /** URL slug, used by /product/[slug]. */
  slug: string;
  title: string;
  author: string;
  category: Category;
  year: number;
  /** Price in US dollars, major units. May carry cents (24.99) — see lib/commerce.ts. */
  price: number;
  /** One-line format / production note. */
  format: string;
  /** Cover artwork: background colour, ink colour and a generated motif key. */
  art: { bg: string; fg: string; shape: Shape };
  /**
   * Commerce backend's own id for the purchasable variant (a Shopify variant
   * GID). Required to build a checkout cart; absent for local and Medusa.
   */
  variantId?: string;
  isNew?: boolean;
  sold?: boolean;
  /** Shown on the product page when the item is sold out. */
  note?: string;
  description: string;
};

export type Shape =
  | "lines"
  | "door"
  | "contour"
  | "grid"
  | "num"
  | "sun"
  | "roof"
  | "circle"
  | "stair";

export type Policy = { title: string; note: string; rows: PolicyRow[] };
export type PolicyRow = { heading: string; body: string };

export type AboutRow = { heading: string; body: string; note?: string };

export type CartLine = { product: Product; qty: number };

export const CATEGORIES: Category[] = ["Books", "Journals", "Prints"];

/** The one currency the shop is priced and sold in. */
export const CURRENCY = "USD";

// PLACEHOLDERS — the seed catalogue is priced from the old NOK figures divided
// by ten, and the shipping rates are guesses. Set real values before launch.
export const SHIPPING_FEE = 8;
export const FREE_SHIPPING_OVER = 60;
