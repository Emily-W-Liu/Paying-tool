import { after, NextResponse } from "next/server";
import { adminAuthError, isAdminAuthenticated } from "@/lib/admin-auth";
import { updateFeishuOrderRecord } from "@/lib/feishu";
import type { OrderStatus } from "@/lib/order-types";
import { readOrders, upsertOrder } from "@/lib/store";

export const runtime = "nodejs";

const allowedStatuses: OrderStatus[] = ["pending", "paid", "rejected"];

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await isAdminAuthenticated())) {
    return adminAuthError();
  }

  const { id } = await context.params;
  const body = (await request.json()) as { status?: OrderStatus };

  if (!body.status || !allowedStatuses.includes(body.status)) {
    return NextResponse.json({ message: "订单状态不正确" }, { status: 400 });
  }

  const orders = await readOrders();
  const order = orders.find((item) => item.id === id);

  if (!order) {
    return NextResponse.json({ message: "订单不存在" }, { status: 404 });
  }

  const updatedOrder = { ...order, status: body.status };
  const savedOrder = {
    ...updatedOrder,
    feishuSyncStatus: undefined,
    feishuSyncMessage: "飞书同步进行中",
  };

  await upsertOrder(savedOrder);

  after(async () => {
    const sync = await updateFeishuOrderRecord(updatedOrder);

    await upsertOrder({
      ...savedOrder,
      feishuRecordId: sync.recordId ?? updatedOrder.feishuRecordId,
      feishuSyncStatus: sync.status,
      feishuSyncMessage: sync.message,
    });
  });

  return NextResponse.json({ order: savedOrder });
}
