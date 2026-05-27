"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CartItem, DemoOrder } from "@/lib/order-types";

export default function SubmitPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedCart = window.localStorage.getItem("event-pay-cart");
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const total = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart],
  );

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cart.length || !customerName || !contact || !screenshot) return;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("customerName", customerName);
      formData.append("contact", contact);
      formData.append("note", note);
      formData.append("cart", JSON.stringify(cart));
      formData.append("screenshot", screenshot);

      const response = await fetch("/api/orders", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        order?: DemoOrder;
        message?: string;
      };

      if (!response.ok || !data.order) {
        throw new Error(data.message ?? "提交失败");
      }

      window.localStorage.removeItem("event-pay-cart");
      window.localStorage.setItem("event-pay-current-order", data.order.id);
      router.push(`/status?order=${data.order.id}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "提交失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl bg-[#f7f5ef] px-4 py-6">
      <Link className="text-sm font-medium text-[#7b341e]" href="/">
        返回修改商品
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-normal text-[#202124]">
        提交信息
      </h1>

      <section className="mt-5 rounded-lg border border-[#e1ddd4] bg-white p-4">
        <h2 className="text-base font-semibold">订单明细</h2>
        <div className="mt-3 space-y-3">
          {cart.length ? (
            cart.map((item) => (
              <div className="flex justify-between gap-4 text-sm" key={item.id}>
                <span className="text-[#5f6368]">
                  {item.name} x {item.quantity}
                </span>
                <span className="font-medium">¥{item.price * item.quantity}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-[#b3261e]">还没有选择商品。</p>
          )}
        </div>
        <div className="mt-4 flex justify-between border-t border-[#ede8df] pt-4">
          <span className="font-medium">合计</span>
          <span className="text-2xl font-semibold">¥{total}</span>
        </div>
      </section>

      <form className="mt-4 space-y-4" onSubmit={submitOrder}>
        <label className="block">
          <span className="text-sm font-medium text-[#202124]">姓名</span>
          <input
            className="mt-2 h-12 w-full rounded-md border border-[#d8d2c7] bg-white px-3 outline-none focus:border-[#202124]"
            onChange={(event) => setCustomerName(event.target.value)}
            required
            value={customerName}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[#202124]">
            手机号或微信号
          </span>
          <input
            className="mt-2 h-12 w-full rounded-md border border-[#d8d2c7] bg-white px-3 outline-none focus:border-[#202124]"
            onChange={(event) => setContact(event.target.value)}
            required
            value={contact}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-[#202124]">备注</span>
          <textarea
            className="mt-2 min-h-24 w-full rounded-md border border-[#d8d2c7] bg-white p-3 outline-none focus:border-[#202124]"
            onChange={(event) => setNote(event.target.value)}
            value={note}
          />
        </label>

        <label className="block rounded-lg border border-dashed border-[#b8b2a7] bg-white p-4">
          <span className="text-sm font-medium text-[#202124]">付款截图</span>
          <input
            accept="image/*"
            className="mt-3 block w-full text-sm"
            onChange={(event) => setScreenshot(event.target.files?.[0] ?? null)}
            required
            type="file"
          />
          <span className="mt-2 block text-xs text-[#6b6257]">
            {screenshot ? screenshot.name : "上传转账或付款完成截图"}
          </span>
        </label>

        <button
          className="h-12 w-full rounded-md bg-[#202124] text-sm font-semibold text-white disabled:bg-[#b8b2a7]"
          disabled={!cart.length || isSubmitting}
          type="submit"
        >
          {isSubmitting ? "提交中" : "提交审核"}
        </button>
        {errorMessage ? (
          <p className="text-sm font-medium text-[#b3261e]">{errorMessage}</p>
        ) : null}
      </form>
    </main>
  );
}
