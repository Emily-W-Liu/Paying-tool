import { after, NextResponse } from "next/server";
import { adminAuthError, isAdminAuthenticated } from "@/lib/admin-auth";
import { createFeishuOrderRecord } from "@/lib/feishu";
import type { CartItem, DemoOrder } from "@/lib/order-types";
import { readOrders, readProducts, upsertOrder } from "@/lib/store";
import { savePaymentScreenshot } from "@/lib/uploads";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return adminAuthError();
  }

  const orders = await readOrders();
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const customerName = String(formData.get("customerName") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const cartJson = String(formData.get("cart") ?? "[]");
  const screenshot = formData.get("screenshot");

  if (!customerName || !contact || !(screenshot instanceof File)) {
    return NextResponse.json({ message: "缺少用户信息或付款截图" }, { status: 400 });
  }

  let cart: CartItem[];
  try {
    cart = JSON.parse(cartJson) as CartItem[];
  } catch {
    return NextResponse.json({ message: "购物车数据格式不正确" }, { status: 400 });
  }

  if (!Array.isArray(cart) || cart.length === 0) {
    return NextResponse.json({ message: "购物车为空" }, { status: 400 });
  }

  const products = await readProducts();
  const activeProducts = products.filter((product) => product.isActive);
  const orders = await readOrders();
  const paidCounts = orders
    .filter((order) => order.status === "paid")
    .flatMap((order) => order.items)
    .reduce<Record<string, number>>((counts, item) => {
      counts[item.id] = (counts[item.id] ?? 0) + item.quantity;
      return counts;
    }, {});

  const items: CartItem[] = [];

  for (const cartItem of cart) {
    const product = activeProducts.find((item) => item.id === cartItem.id);
    if (!product) {
      return NextResponse.json(
        { message: `商品不存在或已下架：${cartItem.name}` },
        { status: 400 },
      );
    }

    const quantity = Math.max(Number(cartItem.quantity) || 0, 0);
    const remaining = Math.max(product.stock - (paidCounts[product.id] ?? 0), 0);

    if (quantity <= 0 || quantity > remaining) {
      return NextResponse.json(
        { message: `${product.name} 库存不足` },
        { status: 400 },
      );
    }

    items.push({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity,
    });
  }

  if (items.some((item) => item.quantity <= 0)) {
    return NextResponse.json({ message: "商品数量不正确" }, { status: 400 });
  }

  const orderId = `EP${Date.now().toString().slice(-8)}`;
  const bytes = Buffer.from(await screenshot.arrayBuffer());
  const upload = await savePaymentScreenshot({
    bytes,
    fileName: screenshot.name,
    mimeType: screenshot.type || "image/png",
    orderId,
    requestUrl: request.url,
  });

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const order: DemoOrder = {
    id: orderId,
    createdAt: new Date().toISOString(),
    customerName,
    contact,
    note,
    items,
    total,
    screenshotName: screenshot.name,
    screenshotUrl: upload.publicUrl,
    status: "pending",
  };

  const savedOrder: DemoOrder = {
    ...order,
    feishuSyncStatus: undefined,
    feishuSyncMessage: "飞书同步进行中",
  };

  await upsertOrder(savedOrder);

  after(async () => {
    const sync = await createFeishuOrderRecord(order, {
      bytes,
      fileName: screenshot.name,
      mimeType: screenshot.type || "image/png",
    });

    await upsertOrder({
      ...savedOrder,
      feishuRecordId: sync.recordId,
      feishuSyncStatus: sync.status,
      feishuSyncMessage: sync.message,
    });
  });

  return NextResponse.json({ order: savedOrder }, { status: 201 });
}
