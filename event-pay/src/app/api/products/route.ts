import { NextResponse } from "next/server";
import { adminAuthError, isAdminAuthenticated } from "@/lib/admin-auth";
import { readPaidOrderItems, readProducts, writeProducts } from "@/lib/store";
import type { Product } from "@/lib/order-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store",
};

export async function GET(request: Request) {
  const view = new URL(request.url).searchParams.get("view");

  if (view === "public") {
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

    return NextResponse.json(
      {
        products: products
          .filter((product) => product.isActive)
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
          }),
      },
      { headers: noStoreHeaders },
    );
  }

  const products = await readProducts();
  return NextResponse.json({ products }, { headers: noStoreHeaders });
}

export async function PUT(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return adminAuthError();
  }

  const body = (await request.json()) as { products?: Product[] };

  if (!Array.isArray(body.products)) {
    return NextResponse.json({ message: "商品数据格式不正确" }, { status: 400 });
  }

  const products = body.products.map((product) => ({
    ...product,
    id: product.id || `product-${Date.now()}`,
    price: Number(product.price) || 0,
    stock: Math.max(Number(product.stock) || 0, 0),
    accent: product.accent || "bg-[#f66f4d]",
    imageUrl: typeof product.imageUrl === "string" ? product.imageUrl : "",
    isActive: Boolean(product.isActive),
  }));

  await writeProducts(products);
  return NextResponse.json({ products }, { headers: noStoreHeaders });
}
