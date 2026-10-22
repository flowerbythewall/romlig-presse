import { notFound } from "next/navigation";
import { listProducts } from "@/lib/commerce";
import { CATEGORIES } from "@/lib/types";

type Params = { params: Promise<{ cat: string }> };

export async function generateStaticParams() {
  const all = await listProducts();
  const used = new Set(all.map((b) => b.category.toLowerCase()));
  return [...used]
    .filter((c) => CATEGORIES.some((x) => x.toLowerCase() === c))
    .map((cat) => ({ cat }));
}

export async function generateMetadata({ params }: Params) {
  const { cat } = await params;
  const title = CATEGORIES.find((c) => c.toLowerCase() === cat.toLowerCase());
  if (!title) return {};
  return { title, alternates: { canonical: `/c/${cat.toLowerCase()}` } };
}

/**
 * /c/<category> is a real route so each category is indexable and linkable.
 * The catalogue grid itself is rendered client-side from this path.
 */
export default async function CategoryRoute({ params }: Params) {
  const { cat } = await params;
  const all = await listProducts();
  const known = CATEGORIES.some((c) => c.toLowerCase() === cat.toLowerCase());
  const hasItems = all.some((b) => b.category.toLowerCase() === cat.toLowerCase());
  if (!known || !hasItems) notFound();
  return null;
}
