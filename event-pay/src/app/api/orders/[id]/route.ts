import { NextResponse } from "next/server";
import { readOrders } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const orders = await readOrders();
  const order = orders.find((item) => item.id === id);

  if (!order) {
    return NextResponse.json({ message: "订单不存在" }, { status: 404 });
  }

  return NextResponse.json(
    {
      order: {
        id: order.id,
        createdAt: order.createdAt,
        items: order.items,
        total: order.total,
        status: order.status,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
