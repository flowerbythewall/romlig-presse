"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine, Product } from "@/lib/types";

type Cart = Record<string, number>;

const CartContext = createContext<{
  cart: Cart;
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
} | null>(null);

const KEY = "rp-cart";

export function CartProvider({
  products,
  children,
}: {
  products: Product[];
  children: React.ReactNode;
}) {
  const [cart, setCart] = useState<Cart>({});

  // Restored from localStorage on mount only; SSR must render the empty cart.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setCart(JSON.parse(raw));
    } catch {
      /* corrupt or unavailable storage — start empty */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(cart));
    } catch {
      /* storage may be unavailable (private mode) */
    }
  }, [cart]);

  const value = useMemo(() => {
    const ids = Object.keys(cart);
    const lines: CartLine[] = ids
      .map((id) => {
        const product = products.find((p) => p.id === id);
        return product ? { product, qty: cart[id] } : null;
      })
      .filter((l): l is CartLine => l !== null && l.qty > 0);

    const count = lines.reduce((n, l) => n + l.qty, 0);
    const sub = lines.reduce((n, l) => n + l.product.price * l.qty, 0);

    return {
      cart,
      lines,
      count,
      subtotal: sub,
      add: (id: string) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 })),
      setQty: (id: string, qty: number) =>
        setCart((c) => {
          if (qty <= 0) {
            const { [id]: _drop, ...rest } = c;
            return rest;
          }
          return { ...c, [id]: qty };
        }),
      remove: (id: string) =>
        setCart((c) => {
          const { [id]: _drop, ...rest } = c;
          return rest;
        }),
      clear: () => setCart({}),
    };
  }, [cart, products]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
