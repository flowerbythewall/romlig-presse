"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import CartDrawer from "./CartDrawer";
import Nav from "./Nav";
import { CATEGORIES, type Category } from "@/lib/types";
import { useCart } from "./CartProvider";
import { CoverArt } from "./CoverArt";
import { ABOUT_ROWS, POLICIES, POLICY_SLUGS } from "@/lib/content";
import { catNo, categoryFromPath, esc, kr } from "@/lib/format";
import type { Product } from "@/lib/types";

type Overlay =
  | { kind: "none" }
  | { kind: "product"; product: Product }
  | { kind: "about" }
  | { kind: "policy"; slug: string };

export default function ShopClient({ products }: { products: Product[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [cartOpen, setCartOpen] = useState(false);
  const { count } = useCart();
  const lastFocus = useRef<Element | null>(null);

  // Everything is derived from the URL, so there is no state to fall out of sync
  // and no flash of the wrong filter on first paint.
  const seg = useMemo(
    () => pathname.replace(/^\//, "").split("/").filter(Boolean),
    [pathname]
  );

  const overlay: Overlay = useMemo(() => {
    if (seg[0] === "product" && seg[1]) {
      const product = products.find((p) => p.slug === seg[1]);
      if (product) return { kind: "product", product };
    }
    if (seg[0] === "about") return { kind: "about" };
    if (seg[0] === "page" && seg[1]) return { kind: "policy", slug: seg[1] };
    return { kind: "none" };
  }, [seg, products]);

  const cat: Category | "All" = useMemo(() => {
    if (seg[0] === "c" && seg[1]) return categoryFromPath(seg[1]);
    return "All";
  }, [seg]);

  // Trap scroll and move focus into the overlay while it is open.
  useEffect(() => {
    if (overlay.kind === "none") return;
    lastFocus.current = document.activeElement;
    document.body.style.overflow = "hidden";
    document.querySelector<HTMLElement>(".pd .close")?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = "";
      const back = lastFocus.current;
      if (back instanceof HTMLElement && document.contains(back)) {
        back.focus({ preventScroll: true });
      }
    };
  }, [overlay.kind]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (cartOpen) return setCartOpen(false);
      if (overlay.kind !== "none") {
        // Escape returns to the catalogue. The overlay is derived from the URL,
        // so navigating away closes it — same as the "Close ×" link.
        router.replace(cat === "All" ? "/" : `/c/${cat.toLowerCase()}`, {
          scroll: false,
        });
      }
    }
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [cartOpen, overlay.kind, cat, router]);

  // Adding to the cart from a product page opens the drawer.
  useEffect(() => {
    function open() {
      setCartOpen(true);
    }
    window.addEventListener("rp:open-cart", open);
    return () => window.removeEventListener("rp:open-cart", open);
  }, []);

  const shown = useMemo(
    () =>
      cat === "All"
        ? products
        : products.filter((p) => p.category.toLowerCase() === cat.toLowerCase()),
    [products, cat]
  );
  const backHref = cat === "All" ? "/" : `/c/${cat.toLowerCase()}`;

  return (
    <>
      <header className="header">
        <Link className="logo" href="/">
          Romlig Presse
        </Link>
        <Nav cat={cat} />
        <Link className={`aboutbtn${overlay.kind === "about" ? " on" : ""}`} href="/about">
          About
        </Link>
        <button
          className="cartbtn"
          onClick={() => setCartOpen(true)}
          aria-controls="cart"
          aria-expanded={cartOpen}
        >
          Cart (<span id="cc" className="num">{count}</span>)
        </button>
      </header>

      <main className="grid">
        {shown.map((b, i) => (
          <Link
            key={b.id}
            className={`work rv${b.sold ? " sold" : ""}`}
            style={{ animationDelay: `${i * 40}ms` }}
            href={`/product/${b.slug}`}
            aria-label={`${esc(b.title)}, ${b.sold ? "sold" : kr(b.price)}`}
          >
            <div className="frame">
              <i />
              <i />
              <i />
              <i />
              <CoverArt
                art={b.art}
                className="cover"
                titleSize={22}
                title={b.title}
                author={b.author}
                numeral={b.title.match(/\d+/)?.[0] ?? null}
              />
            </div>
            <div className="label">
              <div className="no">
                <span>{catNo(b.id)}</span>
                <span>{b.category}</span>
              </div>
              <div className="t">
                {b.title}
                {b.isNew ? <span className="stamp">NEW</span> : null}
              </div>
              <div className="a">
                {b.author}, {b.year}
              </div>
              <div className="med">{b.format}</div>
              <div className="pr">
                {b.sold ? (
                  <>
                    <span className="reddot" aria-hidden="true" />
                    Sold
                  </>
                ) : (
                  kr(b.price)
                )}
              </div>
            </div>
          </Link>
        ))}
      </main>

      <footer className="footer">
        <div className="fl">
          <a href="https://www.instagram.com/" target="_blank" rel="noopener">
            Instagram
          </a>
          <Link href="/page/shipping">Shipping &amp; Returns</Link>
          <Link href="/page/terms">Terms</Link>
          <Link href="/page/privacy">Privacy</Link>
        </div>
        <div className="fc">© 2026 Romlig Presse · Org. no. 000 000 000</div>
      </footer>

      {overlay.kind !== "none" && (
        <div
          className="pd on"
          role="dialog"
          aria-modal="true"
          aria-label={
            overlay.kind === "product" ? overlay.product.title : overlay.kind === "about" ? "About" : "Page"
          }
        >
          {overlay.kind === "product" && (
            <ProductPage
              product={overlay.product}
              products={shown.includes(overlay.product) ? shown : products}
              cat={cat}
              backHref={backHref}
            />
          )}
          {overlay.kind === "about" && <AboutPage />}
          {overlay.kind === "policy" && <PolicyPage slug={overlay.slug} />}
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}

function ProductPage({
  product,
  products,
  cat,
  backHref,
}: {
  product: Product;
  products: Product[];
  cat: string;
  backHref: string;
}) {
  const { cart, add } = useCart();
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const i = products.indexOf(product);
  const prev = products[(i - 1 + products.length) % products.length];
  const next = products[(i + 1) % products.length];
  const inCart = cart[product.id] || 0;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  function onAdd() {
    add(product.id);
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 1400);
    setTimeout(() => window.dispatchEvent(new CustomEvent("rp:open-cart")), 350);
  }

  return (
    <>
      <div className="pd-bar">
        <span className="crumb">
          {cat === "All" ? "Shop" : cat} / <b>{catNo(product.id)}</b>
        </span>
        <Link className="close" href={backHref}>
          Close ×
        </Link>
      </div>

      <div className="pd-in">
        <div className="pd-cover">
          <div className="frame">
            <i />
            <i />
            <i />
            <i />
            <CoverArt
              art={product.art}
              className="cover"
              titleSize={44}
              title={product.title}
              author={product.author}
              numeral={product.title.match(/\d+/)?.[0] ?? null}
            />
          </div>
        </div>

        <div className="pd-side">
          <div className="label">
            <div className="no">
              <span>{catNo(product.id)}</span>
              <span>{product.category}</span>
            </div>
            <div className="t">
              {product.title}
              {product.isNew ? <span className="stamp">NEW</span> : null}
            </div>
            <div className="a">
              {product.author}, {product.year}
            </div>
            <div className="med">{product.format}</div>
            <p className="desc">{product.description}</p>
            <div className="pr">
              {product.sold ? (
                <>
                  <span className="reddot" aria-hidden="true" />
                  Sold
                </>
              ) : (
                kr(product.price)
              )}
            </div>
          </div>

          <button
            className={`btn${added ? " added" : ""}`}
            disabled={product.sold}
            onClick={onAdd}
          >
            {product.sold ? "Sold out" : added ? "Added ✓" : "Add to cart"}
          </button>
          <div className="pd-note">
            {product.sold
              ? product.note || "Out of print."
              : inCart
                ? `${inCart} in your cart`
                : "Ships from Oslo within 2 working days."}
          </div>
        </div>
      </div>

      <div className="pd-pager">
        <Link href={`/product/${prev.slug}`}>
          <small>← PREVIOUS</small>
          <span>{prev.title}</span>
        </Link>
        <Link href={`/product/${next.slug}`}>
          <small>NEXT →</small>
          <span>{next.title}</span>
        </Link>
      </div>
    </>
  );
}

/**
 * Policy/about copy is plain text except for a few inline mailto links, which are
 * marked up in lib/content.ts and rendered here.
 */
function InfoRows() {
  return ABOUT_ROWS.map((r, i) => (
    <div className="label" key={r.heading}>
      <div className="no">
        <span>{String(i + 1).padStart(2, "0")}</span>
        <span>{r.heading}</span>
      </div>
      <div
        className="a"
        dangerouslySetInnerHTML={{
          __html: esc(r.body).replace(
            /&lt;a href=&quot;(.*?)&quot;&gt;(.*?)&lt;\/a&gt;/g,
            '<a href="$1">$2</a>'
          ),
        }}
      />
      {r.note ? (
        <div
          className="med"
          dangerouslySetInnerHTML={{
            __html: esc(r.note).replace(
              /&lt;a href=&quot;(.*?)&quot;&gt;(.*?)&lt;\/a&gt;/g,
              '<a href="$1">$2</a>'
            ),
          }}
        />
      ) : null}
    </div>
  ));
}

function PolicyRows({ slug }: { slug: string }) {
  const policy = POLICIES[slug];
  if (!policy) return null;
  return policy.rows.map((r, i) => (
    <div className="label" key={r.heading}>
      <div className="no">
        <span>{String(i + 1).padStart(2, "0")}</span>
        <span>{r.heading}</span>
      </div>
      <div
        className="a"
        dangerouslySetInnerHTML={{
          __html: esc(r.body).replace(
            /&lt;a href=&quot;(.*?)&quot;&gt;(.*?)&lt;\/a&gt;/g,
            '<a href="$1">$2</a>'
          ),
        }}
      />
    </div>
  ));
}

const POLICY_TITLES: Record<string, string> = Object.fromEntries(
  POLICY_SLUGS.map((s) => [s, POLICIES[s].title])
);

function AboutPage() {
  return (
    <>
      <div className="pd-bar">
        <span className="crumb">
          <b>About</b>
        </span>
        <Link className="close" href="/">
          Close ×
        </Link>
      </div>
      <div className="pd-in">
        <div className="ab-text">
          <p>
            Romlig Presse is an independent publisher in Oslo making books, journals and prints
            about architecture, landscape and the practice of place.
          </p>
          <p>
            We work with architects, writers and printers in Norway. Every title is printed and
            bound in Scandinavia, in small editions.
          </p>
        </div>
        <div className="ab-info">
          <InfoRows />
        </div>
      </div>
    </>
  );
}

function PolicyPage({ slug }: { slug: string }) {
  if (!POLICIES[slug]) {
    return (
      <>
        <div className="pd-bar">
          <span className="crumb">
            <b>Page not found</b>
          </span>
          <Link className="close" href="/">
            Close ×
          </Link>
        </div>
        <div className="pd-in">
          <div className="ab-text">
            <p>
              That page does not exist. <Link href="/">Back to the shop</Link>.
            </p>
          </div>
        </div>
      </>
    );
  }

  const title = POLICIES[slug].title;
  return (
    <>
      <div className="pd-bar">
        <span className="crumb">
          <b>{title}</b>
        </span>
        <Link className="close" href="/">
          Close ×
        </Link>
      </div>
      <div className="pd-in">
        <div className="ab-text">
          <h2>{title}</h2>
          <p className="note">
            <span className="reddot" aria-hidden="true" />
            Placeholder text. Replace with your own policy before launch.
          </p>
        </div>
        <div className="ab-info">
          <PolicyRows slug={slug} />
        </div>
      </div>
    </>
  );
}
