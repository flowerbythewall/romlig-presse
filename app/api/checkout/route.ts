import { NextResponse } from "next/server";
import { COMMERCE_PROVIDER, listProducts, shopifyFetch } from "@/lib/commerce";

type Body = { lines?: { id?: unknown; qty?: unknown }[] };

/**
 * Turns the browser's cart into a Shopify checkout and returns the checkout URL.
 *
 * The cart lives in localStorage, so it cannot be trusted: prices and
 * availability are re-read from the backend (bypassing the 60s cache) before the
 * cart is created. Anything missing or sold out fails the whole request rather
 * than letting Shopify reject one line mid-checkout.
 */
export async function POST(req: Request) {
  if (COMMERCE_PROVIDER !== "shopify") {
    return NextResponse.json({ error: "Checkout is not available." }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;

  const lines = (body?.lines ?? []).filter(
    (l): l is { id: string; qty: number } =>
      typeof l.id === "string" &&
      Number.isInteger(l.qty) &&
      (l.qty as number) > 0 &&
      (l.qty as number) < 100
  );

  if (lines.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const products = await listProducts({ revalidate: true });

  const merchandise = lines.map((l) => {
    const p = products.find((x) => x.id === l.id);
    // No variantId means the adapter cannot sell this item (local/medusa seed
    // data, or a product with no variant).
    return p?.variantId && !p.sold ? { merchandiseId: p.variantId, quantity: l.qty } : null;
  });

  if (merchandise.some((m) => m === null)) {
    return NextResponse.json(
      { error: "Some items are no longer available." },
      { status: 409 }
    );
  }

  const data = await shopifyFetch<{
    cartCreate?: {
      cart?: { checkoutUrl?: string };
      userErrors?: { field?: string[]; message?: string }[];
    };
  }>(
    `mutation cartCreate($input: CartInput) {
      cartCreate(input: $input) {
        cart { checkoutUrl }
        userErrors { field message }
      }
    }`,
    { input: { lines: merchandise } }
  );

  const userError = data?.cartCreate?.userErrors?.[0];
  if (userError) {
    return NextResponse.json({ error: userError.message ?? "Checkout failed." }, { status: 409 });
  }

  const url = data?.cartCreate?.cart?.checkoutUrl;
  if (!url) {
    return NextResponse.json({ error: "Checkout failed." }, { status: 502 });
  }

  return NextResponse.json({ url });
}
