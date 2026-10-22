import { FREE_SHIPPING_OVER, SHIPPING_FEE } from "./types";
import { usd } from "./format";
import type { AboutRow, Policy } from "./types";

/**
 * Shipping figures are generated from lib/types.ts so the copy cannot drift out
 * of sync with the numbers the cart actually uses.
 */
export const ABOUT_ROWS: AboutRow[] = [
  {
    heading: "Visit",
    body: "Kirkegata 15, 0153 Oslo",
    note: "Thursday to Saturday, 12–17",
  },
  {
    heading: "Contact",
    body: '<a href="mailto:post@romligpresse.no">post@romligpresse.no</a>',
    note: "+47 22 00 00 00",
  },
  {
    heading: "Shipping",
    body: "Orders ship within 2 working days.",
    note: `Free shipping over ${usd(FREE_SHIPPING_OVER)}.`,
  },
  {
    heading: "Returns",
    body: "Unused items within 14 days.",
    note: "Write to us before sending anything back.",
  },
  {
    heading: "Trade",
    body: "Bookshops and libraries",
    note: '<a href="mailto:trade@romligpresse.no">trade@romligpresse.no</a>',
  },
];

/**
 * Placeholder policy text — replace with the shop's real terms before launch.
 */
export const POLICIES: Record<string, Policy> = {
  shipping: {
    title: "Shipping & Returns",
    note: "Placeholder text. Replace with your own policy before launch.",
    rows: [
      {
        heading: "Dispatch",
        body: "Orders ship from Oslo within 2 working days.",
      },
      {
        heading: "Rates",
        body: `${usd(SHIPPING_FEE)}. Free shipping over ${usd(FREE_SHIPPING_OVER)}.`,
      },
      {
        heading: "Returns",
        body: "Unused items can be returned within 14 days of delivery. Write to post@romligpresse.no first.",
      },
      {
        heading: "Damaged items",
        body: "Send us a photo within 7 days and we will replace the item.",
      },
    ],
  },
  terms: {
    title: "Terms of Sale",
    note: "Placeholder text. Replace with your own policy before launch.",
    rows: [
      {
        heading: "Seller",
        body: "Romlig Presse AS, Kirkegata 15, 0153 Oslo. Org. no. 000 000 000.",
      },
      {
        heading: "Prices",
        body: "All prices are in US dollars. Sales tax, where applicable, is calculated at checkout.",
      },
      {
        heading: "Payment",
        body: "Card payment at checkout. Your order is confirmed by email.",
      },
      {
        heading: "Right of withdrawal",
        body: "14 days from delivery.",
      },
    ],
  },
  privacy: {
    title: "Privacy",
    note: "Placeholder text. Replace with your own policy before launch.",
    rows: [
      {
        heading: "What we collect",
        body: "Name, email, address and order details needed to deliver your order.",
      },
      {
        heading: "Payments",
        body: "Card details are handled by the payment provider and never stored by us.",
      },
      {
        heading: "Cookies",
        body: "Used to remember your cart. No advertising trackers.",
      },
      {
        heading: "Contact",
        body: '<a href="mailto:post@romligpresse.no">post@romligpresse.no</a>',
      },
    ],
  },
};

export const POLICY_SLUGS = Object.keys(POLICIES);
