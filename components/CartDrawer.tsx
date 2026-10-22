import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart } from "./CartProvider";
import { CoverArt } from "./CoverArt";
import { kr, shippingFor } from "@/lib/format";
import { FREE_SHIPPING_OVER, type CartLine } from "@/lib/types";

function Line({ line, onNavigate }: { line: CartLine; onNavigate: () => void }) {
  const { setQty, remove } = useCart();
  const { product, qty } = line;

  return (
    <div className="ci">
      <Link className="thumb" href={`/product/${product.slug}`} onClick={onNavigate}>
        <CoverArt art={product.art} className="cover" />
      </Link>
      <Link className="t" href={`/product/${product.slug}`} onClick={onNavigate}>
        {product.title}
      </Link>
      <span className="p">{kr(qty * product.price)}</span>
      <span className="qty">
        <button onClick={() => setQty(product.id, qty - 1)} aria-label="Remove one">
          −
        </button>
        <span className="num">{qty}</span>
        <button onClick={() => setQty(product.id, qty + 1)} aria-label="Add one">
          +
        </button>
        <button className="rm" onClick={() => remove(product.id)}>
          Remove
        </button>
      </span>
    </div>
  );
}

export default function CartDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { lines, subtotal: sum, clear } = useCart();
  const [thanks, setThanks] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) closeRef.current?.focus({ preventScroll: true });
  }, [open]);

  const ship = shippingFor(sum);

  function checkout() {
    // Demo only: no payment provider is wired up yet.
    clear();
    setThanks(true);
    setTimeout(() => setThanks(false), 4000);
  }

  return (
    <>
      <div
        className={`scrim${open ? " on" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside id="cart" className={`cart${open ? " on" : ""}`} aria-label="Cart">
        <div className="ch">
          <span>Cart</span>
          <button ref={closeRef} onClick={onClose}>
            Close ×
          </button>
        </div>

        <div className="citems">
          {thanks ? (
            <p className="empty">
              Thank you for your order.
              <br />
              <span style={{ fontSize: 12 }}>
                This is a demo. No payment was taken.
              </span>
            </p>
          ) : lines.length === 0 ? (
            <p className="empty">
              Your cart is empty.
              <br />
              <button onClick={onClose}>Browse the catalogue</button>
            </p>
          ) : (
            lines.map((l) => <Line key={l.product.id} line={l} onNavigate={onClose} />)
          )}
        </div>

        <div className="cf">
          {thanks || lines.length === 0 ? (
            <button className="btn" disabled>
              Checkout
            </button>
          ) : (
            <>
              <div className="row">
                <span>Subtotal</span>
                <span>{kr(sum)}</span>
              </div>
              <div className="row">
                <span>Shipping</span>
                <span>{ship ? kr(ship) : "Free"}</span>
              </div>
              <div className="row sum">
                <span>Total</span>
                <span>{kr(sum + ship)}</span>
              </div>
              <div className="hint">
                {ship
                  ? `${kr(FREE_SHIPPING_OVER - sum)} away from free shipping`
                  : "You have free shipping"}
              </div>
              <div
                className="meter"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={FREE_SHIPPING_OVER}
                aria-valuenow={Math.min(sum, FREE_SHIPPING_OVER)}
              >
                <b style={{ width: `${Math.min(100, (sum / FREE_SHIPPING_OVER) * 100)}%` }} />
              </div>
              <button className="btn" onClick={checkout}>
                Checkout
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
