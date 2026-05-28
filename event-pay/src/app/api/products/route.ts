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
  const products = await readProducts();

  if (view === "public") {
    const paidItems = await readPaidOrderItems();
    const paidCounts = paidItems.reduce<Record<string, number>>((counts, item) => {
      counts[item.id] = (counts[item.id] ?? 0) + item.quantity;
      return counts;
    }, {});

    return NextResponse.json(
      {
        products: products
          .filter((product) => product.isActive)
          .map((product) => ({
            ...product,
            stock: Math.max(product.stock - (paidCounts[product.id] ?? 0), 0),
          })),
      },
      { headers: noStoreHeaders },
    );
  }

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
    imageUrl: typeof product.imageUrl === "string" ? product.imageUrl : "",
    isActive: Boolean(product.isActive),
  }));

  await writeProducts(products);
  return NextResponse.json({ products }, { headers: noStoreHeaders });
}
