import Link from "next/link";
import { CATEGORIES, type Category } from "@/lib/types";

/**
 * Category filter. These are real paths ("/", "/c/books"), so each category is
 * linkable and indexable — the grid re-renders from the URL on click.
 */
export default function Nav({ cat }: { cat: Category | "All" }) {
  const links: { label: string; href: string; on: boolean }[] = [
    { label: "All", href: "/", on: cat === "All" },
    ...CATEGORIES.map((c) => ({
      label: c,
      href: `/c/${c.toLowerCase()}`,
      on: cat === c,
    })),
  ];

  return (
    <nav className="nav" aria-label="Categories">
      {links.map((l) => (
        <Link key={l.label} href={l.href} className={l.on ? "on" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
