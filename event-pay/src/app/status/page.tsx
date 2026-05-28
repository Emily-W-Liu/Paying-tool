"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { DemoOrder } from "@/lib/order-types";

const statusCopy = {
  pending: {
    title: "等待商家确认",
    body: "付款截图已提交，商家确认后这里会显示已支付。",
    badge: "bg-[#fff4ce] text-[#7b341e]",
  },
  paid: {
    title: "已支付",
    body: "订单已确认，到场时可出示此页面。",
    badge: "bg-[#dff7e8] text-[#116329]",
  },
  rejected: {
    title: "需要重新提交",
    body: "付款截图未通过审核，请联系商家处理。",
    badge: "bg-[#fde7e9] text-[#b3261e]",
  },
};

function StatusContent() {
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<DemoOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState("");

  useEffect(() => {
    let isActive = true;

    async function loadOrder() {
      const orderId =
        searchParams.get("order") ??
        window.localStorage.getItem("event-pay-current-order");
      if (!orderId) {
        if (isActive) {
          setOrder(null);
          setIsLoading(false);
        }
        return;
      }

      let nextOrder: DemoOrder | null = null;

      try {
        const response = await fetch(`/api/orders/${orderId}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as { order?: DemoOrder };
        nextOrder = response.ok && data.order ? data.order : null;
      } catch {
        if (isActive) {
          setIsLoading(false);
        }
        return;
      }

      if (!isActive) return;
      setOrder(nextOrder);
      setIsLoading(false);
      setLastUpdatedAt(new Date().toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }));

      if (nextOrder && nextOrder.status !== "pending" && intervalId) {
        window.clearInterval(intervalId);
      }
    }

    const intervalId = window.setInterval(loadOrder, 3000);
    void loadOrder();

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [searchParams]);

  if (isLoading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-2xl bg-[#f7f5ef] px-4 py-6">
        <p className="text-sm text-[#6b6257]">正在读取订单状态...</p>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-2xl bg-[#f7f5ef] px-4 py-6">
        <h1 className="text-2xl font-semibold">没有找到订单</h1>
        <Link
          className="mt-4 inline-block text-sm font-medium text-[#7b341e]"
          href="/"
        >
          返回商品页
        </Link>
      </main>
    );
  }

  const copy = statusCopy[order.status];

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl bg-[#f7f5ef] px-4 py-6">
      <Link className="text-sm font-medium text-[#7b341e]" href="/">
        返回商品页
      </Link>

      <section className="mt-5 rounded-lg border border-[#e1ddd4] bg-white p-5">
        <span
          className={`inline-flex rounded-md px-3 py-1 text-sm font-semibold ${copy.badge}`}
        >
          {copy.title}
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-normal">
          订单 {order.id}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#5f6368]">{copy.body}</p>
        {order.status === "pending" ? (
          <p className="mt-2 text-xs text-[#6b6257]">
            页面会自动更新状态{lastUpdatedAt ? `，上次检查 ${lastUpdatedAt}` : ""}
          </p>
        ) : null}

        <div className="mt-6 space-y-3 border-t border-[#ede8df] pt-5">
          {order.items.map((item) => (
            <div className="flex justify-between text-sm" key={item.id}>
              <span className="text-[#5f6368]">
                {item.name} x {item.quantity}
              </span>
              <span className="font-medium">¥{item.price * item.quantity}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-between border-t border-[#ede8df] pt-5">
          <span className="font-medium">实付金额</span>
          <span className="text-2xl font-semibold">¥{order.total}</span>
        </div>
      </section>
    </main>
  );
}

export default function StatusPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto min-h-screen w-full max-w-2xl bg-[#f7f5ef] px-4 py-6">
          <p className="text-sm text-[#6b6257]">正在读取订单状态...</p>
        </main>
      }
    >
      <StatusContent />
    </Suspense>
  );
}
