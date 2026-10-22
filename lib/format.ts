import { CATEGORIES, FREE_SHIPPING_OVER, SHIPPING_FEE } from "./types";

/** Prices are whole NOK (major units) — both adapters normalise to this. */
export function kr(n: number): string {
  return "NOK " + n.toLocaleString("en-GB");
}

export function catNo(id: string): string {
  const digits = id.replace(/\D/g, "") || "0";
  return "Cat. " + String(Number(digits)).padStart(3, "0");
}

export function subtotal(lines: { price: number; qty: number }[]): number {
  return lines.reduce((sum, l) => sum + l.price * l.qty, 0);
}

export function shippingFor(sum: number): number {
  return sum >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FEE;
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
