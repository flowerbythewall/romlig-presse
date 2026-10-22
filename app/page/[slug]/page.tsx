import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { POLICIES } from "@/lib/content";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return Object.keys(POLICIES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const policy = POLICIES[slug];
  if (!policy) return {};
  return {
    title: policy.title,
    description: policy.rows.map((r) => r.body).join(" "),
    alternates: { canonical: `/page/${slug}` },
  };
}

export default async function PolicyRoute({ params }: Params) {
  const { slug } = await params;
  if (!POLICIES[slug]) notFound();
  return null;
}
