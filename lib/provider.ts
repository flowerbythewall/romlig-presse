/**
 * Which commerce backend the shop reads from.
 *
 * Shared by server code (lib/commerce.ts) and client code (the cart drawer needs
 * to know whether to show a real checkout button), so it must not import
 * anything server-only.
 */
const PROVIDERS = ["local", "shopify", "medusa"] as const;

export type CommerceProvider = (typeof PROVIDERS)[number];

function readProvider(): CommerceProvider {
  const raw = process.env.NEXT_PUBLIC_COMMERCE_PROVIDER;

  // Only an *unset* variable falls back to the local seed catalogue. An empty
  // string or a typo is a mistake worth failing on: falling back silently would
  // put demo products in front of customers.
  if (raw === undefined) return "local";

  const value = raw.trim().toLowerCase();
  if (!(PROVIDERS as readonly string[]).includes(value)) {
    throw new Error(
      `[romlig-presse] Unknown NEXT_PUBLIC_COMMERCE_PROVIDER "${raw}" — expected one of: ${PROVIDERS.join(", ")}.`
    );
  }
  return value as CommerceProvider;
}

export const COMMERCE_PROVIDER: CommerceProvider = readProvider();
