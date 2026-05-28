"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DemoOrder, OrderStatus, Product } from "@/lib/order-types";

const statusLabels: Record<OrderStatus, string> = {
  pending: "待审核",
  paid: "已支付",
  rejected: "已驳回",
};

const statusBadgeClass: Record<OrderStatus, string> = {
  pending: "bg-[#fff4ce] text-[#7b341e]",
  paid: "bg-[#dff7e8] text-[#116329]",
  rejected: "bg-[#fde7e9] text-[#b3261e]",
};

export default function AdminPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<DemoOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [updatingOrderIds, setUpdatingOrderIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const sessionResponse = await fetch("/api/admin/session");
      const sessionData = (await sessionResponse.json()) as {
        authenticated: boolean;
      };

      if (!sessionData.authenticated) {
        router.replace("/merchant/login?next=/merchant");
        return;
      }

      const [productsResponse, ordersResponse] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/orders"),
      ]);
      const productsData = (await productsResponse.json()) as {
        products: Product[];
      };
      const ordersData = (await ordersResponse.json()) as {
        orders: DemoOrder[];
      };
      setProducts(productsData.products);
      setOrders(ordersData.orders);
      setIsLoading(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [router]);

  const paidCounts = useMemo(() => {
    return orders
      .filter((order) => order.status === "paid")
      .flatMap((order) => order.items)
      .reduce<Record<string, number>>((counts, item) => {
        counts[item.id] = (counts[item.id] ?? 0) + item.quantity;
        return counts;
      }, {});
  }, [orders]);

  const paidByLocation = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    for (const order of orders.filter((o) => o.status === "paid")) {
      const loc = order.location ?? "";
      if (!loc) continue;
      result[loc] ??= {};
      for (const item of order.items) {
        result[loc][item.id] = (result[loc][item.id] ?? 0) + item.quantity;
      }
    }
    return result;
  }, [orders]);

  async function updateOrderStatus(orderId: string, status: OrderStatus) {
    setErrorMessage("");
    setUpdatingOrderIds((current) => ({ ...current, [orderId]: true }));

    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as {
        order?: DemoOrder;
        message?: string;
      };

      if (!response.ok || !data.order) {
        setErrorMessage(data.message ?? "订单状态更新失败");
        return;
      }

      setOrders((current) =>
        current.map((order) => (order.id === orderId ? data.order! : order)),
      );
    } catch {
      setErrorMessage("订单状态更新失败，请稍后重试");
    } finally {
      setUpdatingOrderIds((current) => ({ ...current, [orderId]: false }));
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/merchant/login");
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#f7f5ef] px-4 py-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm text-[#6b6257]">正在验证后台登录...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f5ef] px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#7b341e]">商家后台</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
              库存与订单审核
            </h1>
          </div>
          <div className="flex gap-2">
            <Link
              className="rounded-md border border-[#d5d0c6] bg-white px-3 py-2 text-sm font-medium"
              href="/merchant/feishu"
            >
              飞书联调
            </Link>
            <Link
              className="rounded-md border border-[#d5d0c6] bg-white px-3 py-2 text-sm font-medium"
              href="/merchant/products"
            >
              商品配置
            </Link>
            <Link
              className="rounded-md border border-[#d5d0c6] bg-white px-3 py-2 text-sm font-medium"
              href="/"
            >
              商品页
            </Link>
            <button
              className="rounded-md border border-[#d5d0c6] bg-white px-3 py-2 text-sm font-medium"
              onClick={logout}
              type="button"
            >
              退出
            </button>
          </div>
        </div>

        <section className="mt-6 grid gap-3 md:grid-cols-3">
          {products.map((product) => {
            const paid = paidCounts[product.id] ?? 0;
            const remaining = Math.max(product.stock - paid, 0);
            const stockWidth = product.stock
              ? Math.max((remaining / product.stock) * 100, 0)
              : 0;
            const locationEntries = Object.entries(product.stockLocations ?? {});

            return (
              <article
                className="rounded-lg border border-[#e1ddd4] bg-white p-4"
                key={product.id}
              >
                <div
                  className={`mb-4 h-2 rounded-full ${product.accent}`}
                  style={{ width: `${stockWidth}%` }}
                />
                <h2 className="font-semibold">{product.name}</h2>
                {locationEntries.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {locationEntries.map(([loc, locStock]) => {
                      const locPaid = paidByLocation[loc]?.[product.id] ?? 0;
                      const locRemaining = Math.max(locStock - locPaid, 0);
                      const locWidth = locStock ? Math.max((locRemaining / locStock) * 100, 0) : 0;
                      return (
                        <div key={loc}>
                          <div className="flex justify-between text-xs text-[#6b6257]">
                            <span>{loc}</span>
                            <span>{locRemaining} / {locStock}</span>
                          </div>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-[#f0ece4]">
                            <div
                              className={`h-1.5 rounded-full ${product.accent}`}
                              style={{ width: `${locWidth}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-[#6b6257]">初始</dt>
                      <dd className="mt-1 font-semibold">{product.stock}</dd>
                    </div>
                    <div>
                      <dt className="text-[#6b6257]">已支付</dt>
                      <dd className="mt-1 font-semibold">{paid}</dd>
                    </div>
                    <div>
                      <dt className="text-[#6b6257]">剩余</dt>
                      <dd className="mt-1 font-semibold">{remaining}</dd>
                    </div>
                  </dl>
                )}
              </article>
            );
          })}
        </section>

        <section className="mt-6 rounded-lg border border-[#e1ddd4] bg-white">
          <div className="border-b border-[#ede8df] p-4">
            <h2 className="text-lg font-semibold">交易记录</h2>
            <p className="mt-1 text-sm text-[#6b6257]">
              提交订单后自动尝试同步到飞书多维表格，确认或驳回时会更新状态。
            </p>
            {errorMessage ? (
              <p className="mt-2 text-sm font-medium text-[#b3261e]">
                {errorMessage}
              </p>
            ) : null}
          </div>

          <div className="divide-y divide-[#ede8df]">
            {orders.length ? (
              orders.map((order) => {
                const isUpdating = Boolean(updatingOrderIds[order.id]);

                return (
                  <article className="grid gap-4 p-4 md:grid-cols-[1fr_180px]" key={order.id}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{order.id}</h3>
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-medium ${statusBadgeClass[order.status]}`}
                      >
                        {statusLabels[order.status]}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#6b6257]">
                      {order.customerName} · {order.contact}
                      {order.location ? ` · ${order.location}` : ""}
                    </p>
                    <div className="mt-3 space-y-1 text-sm">
                      {order.items.map((item) => (
                        <p key={item.id}>
                          {item.name} x {item.quantity}
                        </p>
                      ))}
                    </div>
                    <p className="mt-3 font-semibold">¥{order.total}</p>
                    {order.note ? (
                      <p className="mt-2 text-sm text-[#6b6257]">备注：{order.note}</p>
                    ) : null}
                    {order.feishuSyncMessage ? (
                      <p className="mt-2 text-xs text-[#6b6257]">
                        飞书同步：{order.feishuSyncMessage}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    {order.screenshotUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={`${order.id} 付款截图`}
                        className="aspect-[4/3] w-full rounded-md border border-[#ede8df] object-cover"
                        src={order.screenshotUrl}
                      />
                    ) : null}
                    {order.status === "pending" ? (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          className="h-10 rounded-md bg-[#116329] text-sm font-semibold text-white"
                          disabled={isUpdating}
                          onClick={() => updateOrderStatus(order.id, "paid")}
                          type="button"
                        >
                          {isUpdating ? "处理中" : "确认付款"}
                        </button>
                        <button
                          className="h-10 rounded-md border border-[#d5d0c6] text-sm font-semibold"
                          disabled={isUpdating}
                          onClick={() => updateOrderStatus(order.id, "rejected")}
                          type="button"
                        >
                          {isUpdating ? "处理中" : "驳回"}
                        </button>
                      </div>
                    ) : (
                      <button
                        className="h-10 w-full rounded-md bg-[#f1eee7] text-sm font-semibold text-[#6b6257]"
                        disabled
                        type="button"
                      >
                        {order.status === "paid" ? "已确认付款" : "已驳回"}
                      </button>
                    )}
                  </div>
                </article>
                );
              })
            ) : (
              <p className="p-4 text-sm text-[#6b6257]">
                还没有订单，先从商品页提交一单试试看。
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
