import type { Product } from "./types";

/** Deterministic slug, matching the original build's normalisation. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

type Raw = Omit<Product, "slug">;

function slug(items: Raw[]): Product[] {
  return items.map((b) => ({ ...b, slug: slugify(b.title) }));
}

/**
 * Local fallback catalogue. Shipped so the shop renders out of the box.
 * Point lib/commerce at Shopify or Medusa and these become seed data only.
 */
export const BOOKS: Product[] = slug([
  {
    id: "1",
    title: "Wood, Rhythm and Time",
    author: "Ingrid Aas",
    category: "Books",
    year: 2026,
    price: 420,
    format: "Offset, sewn. 17 × 24 cm, 288 pp.",
    art: { bg: "#d9c9a8", fg: "#3a2a14", shape: "lines" },
    isNew: true,
    description:
      "Norwegian timber architecture through three generations of carpenters, from log building to cross-laminated timber.",
  },
  {
    id: "2",
    title: "Threshold",
    author: "Mads Lund Hagen",
    category: "Books",
    year: 2026,
    price: 280,
    format: "Offset, softcover. 12 × 19 cm, 144 pp.",
    art: { bg: "#e3242b", fg: "#fff", shape: "door" },
    isNew: true,
    description:
      "Ten short essays on doorsteps and the moment of passing from outside to inside.",
  },
  {
    id: "3",
    title: "Landscape as Archive",
    author: "Sofie Berg (ed.)",
    category: "Books",
    year: 2025,
    price: 390,
    format: "Offset, softcover. 16 × 23 cm, 240 pp.",
    art: { bg: "#7f9a7a", fg: "#14231a", shape: "contour" },
    description:
      "Twelve contributors read the cultural landscape as a record of use, loss and repair.",
  },
  {
    id: "4",
    title: "Concrete, Box and Dwelling",
    author: "Erik Nævdal",
    category: "Books",
    year: 2025,
    price: 450,
    format: "Offset, hardcover. 20 × 26 cm, 320 pp.",
    art: { bg: "#c4c4c0", fg: "#111", shape: "grid" },
    description:
      "Post-war housing blocks in Oslo and Bergen: designed, despised and rediscovered.",
  },
  {
    id: "5",
    title: "Journal No. 14",
    author: "Journal",
    category: "Journals",
    year: 2026,
    price: 180,
    format: "Stapled. 21 × 28 cm, 112 pp.",
    art: { bg: "#111", fg: "#fff", shape: "num" },
    isNew: true,
    description: "Special issue on reuse and material banks.",
  },
  {
    id: "6",
    title: "Journal No. 13",
    author: "Journal",
    category: "Journals",
    year: 2025,
    price: 180,
    format: "Stapled. 21 × 28 cm, 112 pp.",
    art: { bg: "#2d4a8a", fg: "#fff", shape: "num" },
    description: "Special issue on school buildings and learning spaces.",
  },
  {
    id: "7",
    title: "Light in the North",
    author: "Hanne Wiik",
    category: "Books",
    year: 2024,
    price: 320,
    format: "Offset, softcover. 13 × 20 cm, 176 pp.",
    art: { bg: "#f2d64b", fg: "#111", shape: "sun" },
    description:
      "An essay on daylight, polar night and architecture designed for the light that is missing.",
  },
  {
    id: "8",
    title: "The Cabin",
    author: "Kari Moe, Jon Ruud",
    category: "Books",
    year: 2023,
    price: 480,
    format: "Offset, hardcover. 22 × 28 cm, 352 pp.",
    art: { bg: "#8a4b2f", fg: "#fff", shape: "roof" },
    sold: true,
    note: "New printing in spring 2027.",
    description: "The Norwegian cabin, from hunting lodge to luxury object.",
  },
  {
    id: "9",
    title: "Plan of a Staircase",
    author: "Romlig Presse",
    category: "Prints",
    year: 2025,
    price: 250,
    format: "Risograph, 2 colours. 50 × 70 cm. Edition of 150.",
    art: { bg: "#f4f4f4", fg: "#e3242b", shape: "stair" },
    description: "Poster printed in Oslo. Shipped rolled in a tube.",
  },
  {
    id: "10",
    title: "Towards a Circular Building Culture",
    author: "Ane Fosse (ed.)",
    category: "Books",
    year: 2023,
    price: 360,
    format: "Offset, softcover. 16 × 23 cm, 224 pp.",
    art: { bg: "#c9d4d8", fg: "#1d2b33", shape: "circle" },
    description:
      "Architects, engineers and craftspeople on building with what already exists.",
  },
  {
    id: "11",
    title: "Section",
    author: "Romlig Presse",
    category: "Prints",
    year: 2026,
    price: 250,
    format: "Risograph, 1 colour. 50 × 70 cm. Edition of 100.",
    art: { bg: "#f4f4f4", fg: "#2d4a8a", shape: "lines" },
    description:
      "Poster showing a section through a log structure. Shipped rolled in a tube.",
  },
  {
    id: "12",
    title: "Journal No. 12",
    author: "Journal",
    category: "Journals",
    year: 2024,
    price: 180,
    format: "Stapled. 21 × 28 cm, 112 pp.",
    art: { bg: "#d8d2c2", fg: "#111", shape: "num" },
    sold: true,
    description: "Special issue on timber.",
  },
]);

export function bySlug(slug: string): Product | undefined {
  return BOOKS.find((b) => b.slug === slug);
}

/**
 * The motif is derived from the journal number when the cover is a "num"
 * cover, so the shape stays in sync if titles are renamed.
 */
export function shapeLabel(p: Product): string {
  if (p.art.shape !== "num") return p.art.shape;
  return p.title.match(/\d+/)?.[0] ?? "0";
}

