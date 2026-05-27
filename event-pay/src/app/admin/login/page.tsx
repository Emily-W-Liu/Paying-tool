"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = (await response.json()) as { message?: string };

    if (!response.ok) {
      setErrorMessage(data.message ?? "登录失败");
      setIsSubmitting(false);
      return;
    }

    router.replace(searchParams.get("next") ?? "/admin");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-[#f7f5ef] px-4 py-8">
      <Link className="text-sm font-medium text-[#7b341e]" href="/">
        返回商品页
      </Link>
      <section className="mt-5 rounded-lg border border-[#e1ddd4] bg-white p-5">
        <p className="text-sm font-medium text-[#7b341e]">商家后台</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-normal">
          登录
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#6b6257]">
          输入后台密码后才能查看订单、付款截图和商品配置。
        </p>

        <form className="mt-5 space-y-4" onSubmit={login}>
          <label className="block">
            <span className="text-sm font-medium">后台密码</span>
            <input
              className="mt-2 h-12 w-full rounded-md border border-[#d8d2c7] bg-white px-3 outline-none focus:border-[#202124]"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button
            className="h-12 w-full rounded-md bg-[#202124] text-sm font-semibold text-white disabled:bg-[#b8b2a7]"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "登录中" : "进入后台"}
          </button>
          {errorMessage ? (
            <p className="text-sm font-medium text-[#b3261e]">
              {errorMessage}
            </p>
          ) : null}
        </form>

        <p className="mt-4 text-xs leading-5 text-[#6b6257]">
          本地开发默认密码是 admin123。上线前请在环境变量里设置 ADMIN_PASSWORD。
        </p>
      </section>
    </main>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center bg-[#f7f5ef] px-4 py-8">
          <p className="text-sm text-[#6b6257]">正在打开登录页...</p>
        </main>
      }
    >
      <AdminLoginContent />
    </Suspense>
  );
}
