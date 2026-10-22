import { CATEGORIES, CURRENCY, FREE_SHIPPING_OVER, SHIPPING_FEE } from "./types";

const MONEY = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: CURRENCY,
  // Two decimals, matching what Shopify shows on its own checkout page.
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** US dollars, major units (24.99). */
export function usd(n: number): string {
  return MONEY.format(n);
}

/**
 * Money maths goes through integer cents so 59.98 never renders as
 * 59.980000000000004 and `0.1 + 0.2`-style drift cannot reach the totals.
 */
export const toCents = (n: number) => Math.round(n * 100);

export function catNo(id: string): string {
  const digits = id.replace(/\D/g, "") || "0";
  return "Cat. " + String(Number(digits)).padStart(3, "0");
}

export function subtotal(lines: { price: number; qty: number }[]): number {
  return lines.reduce((sum, l) => sum + toCents(l.price) * l.qty, 0) / 100;
}

export function shippingFor(sum: number): number {
  return toCents(sum) >= toCents(FREE_SHIPPING_OVER) ? 0 : SHIPPING_FEE;
}

export function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c)
  );
}

/** Splits a hash path into its segments, ignoring the leading "#". */
export function segments(hash: string): string[] {
  return (hash.replace(/^#\/?/, "") || "").split("/").filter(Boolean);
}

export function categoryFromPath(path: string): (typeof CATEGORIES)[number] | "All" {
  const found = CATEGORIES.find((c) => c.toLowerCase() === path.toLowerCase());
  return found ?? "All";
}

export { SHIPPING_FEE, FREE_SHIPPING_OVER };
