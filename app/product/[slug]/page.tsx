import { notFound } from "next/navigation";
import { getProduct, listProducts } from "@/lib/commerce";

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  const all = await listProducts();
  return all.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return {};
  return {
    title: product.title,
    description: product.description,
    alternates: { canonical: `/product/${product.slug}` },
  };
}

/**
 * The product overlay is rendered by the client from this URL, so this route
 * only has to prove the slug is real (and carry the SEO metadata).
 */
export default async function ProductRoute({ params }: Params) {
  const { slug } = await params;
  if (!(await getProduct(slug))) notFound();
  return null;
}
