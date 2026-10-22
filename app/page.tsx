/**
 * The shop runs as one client surface: the catalogue grid, the product overlay,
 * the about/policy overlays and the cart drawer are all rendered by
 * components/ShopClient.tsx and switched from the URL.
 *
 * These routes exist so every state is a real, linkable URL:
 *   /                     catalogue, all categories
 *   /c/books              catalogue filtered by category
 *   /product/<slug>       product overlay
 *   /about                about overlay
 *   /page/<slug>          policy overlay (shipping, terms, privacy)
 */
export default function Home() {
  return null;
}
