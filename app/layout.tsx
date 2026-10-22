import { listProducts } from "@/lib/commerce";
import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import ShopClient from "@/components/ShopClient";

export const metadata: Metadata = {
  title: "Romlig Presse Shop",
  description:
    "Independent publisher in Oslo: books, journals and prints about architecture, landscape and the practice of place.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read from lib/commerce — swap the provider there and the UI does not change.
  const products = await listProducts();
  return (
    <html lang="en">
      <body>
        <CartProvider products={products}>
          <ShopClient products={products} />
        </CartProvider>
        {children}
      </body>
    </html>
  );
}
