import { readPaidOrderItems, readProducts } from "@/lib/store";
import type { Product } from "@/lib/order-types";
import ProductsClient from "./products-client";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [products, paidOrders] = await Promise.all([
    readProducts(),
    readPaidOrderItems(),
  ]);

  const paidByLocation: Record<string, Record<string, number>> = {};
  const paidTotal: Record<string, number> = {};
  for (const { items, location } of paidOrders) {
    for (const item of items) {
      paidTotal[item.id] = (paidTotal[item.id] ?? 0) + item.quantity;
      if (location) {
        paidByLocation[location] ??= {};
        paidByLocation[location][item.id] =
          (paidByLocation[location][item.id] ?? 0) + item.quantity;
      }
    }
  }

  const publicProducts: Product[] = products
    .filter((p) => p.isActive)
    .map((product) => {
      const hasLocations = Object.keys(product.stockLocations).length > 0;
      return {
        ...product,
        stock: Math.max(product.stock - (paidTotal[product.id] ?? 0), 0),
        stockLocations: hasLocations
          ? Object.fromEntries(
              Object.entries(product.stockLocations).map(([loc, locStock]) => [
                loc,
                Math.max(locStock - (paidByLocation[loc]?.[product.id] ?? 0), 0),
              ]),
            )
          : {},
      };
    });

  return <ProductsClient products={publicProducts} />;
}
