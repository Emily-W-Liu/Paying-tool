"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FeishuCheckResult } from "@/lib/feishu";

type TestRecordResult = {
  status: "skipped" | "synced" | "failed";
  message: string;
  recordId?: string;
};

export default function FeishuAdminPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [checkResult, setCheckResult] = useState<FeishuCheckResult | null>(null);
  const [testResult, setTestResult] = useState<TestRecordResult | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      const response = await fetch("/api/admin/session");
      const data = (await response.json()) as { authenticated: boolean };

      if (!data.authenticated) {
        router.replace("/merchant/login?next=/merchant/feishu");
        return;
      }

      setIsLoading(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [router]);

  async function checkConnection() {
    setIsChecking(true);
    setTestResult(null);

    const response = await fetch("/api/admin/feishu/check");
    const data = (await response.json()) as FeishuCheckResult;
    setCheckResult(data);
    setIsChecking(false);
  }

  async function writeTestRecord() {
    setIsWriting(true);

    const response = await fetch("/api/admin/feishu/test-record", {
      method: "POST",
    });
    const data = (await response.json()) as TestRecordResult;
    setTestResult(data);
    setIsWriting(false);
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[#7b341e]">商家后台</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">
              飞书多维表格联调
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6b6257]">
              先检查环境变量、应用凭证、表格访问权限和字段名；通过后再写入一条测试记录。
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              className="rounded-md border border-[#d5d0c6] bg-white px-3 py-2 text-sm font-medium"
              href="/merchant"
            >
              返回后台
            </Link>
            <Link
              className="rounded-md border border-[#d5d0c6] bg-white px-3 py-2 text-sm font-medium"
              href="/merchant/products"
            >
              商品配置
            </Link>
          </div>
        </div>

        <section className="mt-6 rounded-lg border border-[#e1ddd4] bg-white p-4">
          <div className="flex flex-wrap gap-3">
            <button
              className="h-11 rounded-md bg-[#202124] px-5 text-sm font-semibold text-white disabled:bg-[#b8b2a7]"
              disabled={isChecking}
              onClick={checkConnection}
              type="button"
            >
              {isChecking ? "检查中" : "检查连接和字段"}
            </button>
            <button
              className="h-11 rounded-md border border-[#d5d0c6] px-5 text-sm font-semibold disabled:text-[#b8b2a7]"
              disabled={isWriting || !checkResult || checkResult.missingFields.length > 0}
              onClick={writeTestRecord}
              type="button"
            >
              {isWriting ? "写入中" : "写入测试记录"}
            </button>
          </div>
        </section>

        {checkResult ? (
          <section className="mt-4 rounded-lg border border-[#e1ddd4] bg-white p-4">
            <h2 className="text-lg font-semibold">检查结果</h2>
            <div className="mt-4 space-y-3">
              {checkResult.steps.map((step) => (
                <div
                  className="flex items-start justify-between gap-4 rounded-md bg-[#f7f5ef] p-3"
                  key={step.name}
                >
                  <div>
                    <p className="font-medium">{step.name}</p>
                    <p className="mt-1 text-sm text-[#6b6257]">{step.message}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${
                      step.ok
                        ? "bg-[#dff7e8] text-[#116329]"
                        : "bg-[#fde7e9] text-[#b3261e]"
                    }`}
                  >
                    {step.ok ? "通过" : "未通过"}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">需要的字段</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {checkResult.expectedFields.map((field) => (
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-medium ${
                        checkResult.missingFields.includes(field)
                          ? "bg-[#fde7e9] text-[#b3261e]"
                          : "bg-[#dff7e8] text-[#116329]"
                      }`}
                      key={field}
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold">表里实际字段</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {checkResult.fields.length ? (
                    checkResult.fields.map((field) => (
                      <span
                        className="rounded-md bg-[#f1eee7] px-2 py-1 text-xs font-medium text-[#6b6257]"
                        key={field.field_id}
                      >
                        {field.field_name} · {field.ui_type}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-[#6b6257]">
                      暂未读取到字段
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {testResult ? (
          <section className="mt-4 rounded-lg border border-[#e1ddd4] bg-white p-4">
            <h2 className="text-lg font-semibold">测试写入</h2>
            <p
              className={`mt-2 text-sm font-medium ${
                testResult.status === "synced"
                  ? "text-[#116329]"
                  : "text-[#b3261e]"
              }`}
            >
              {testResult.message}
            </p>
            {testResult.recordId ? (
              <p className="mt-2 text-sm text-[#6b6257]">
                record_id：{testResult.recordId}
              </p>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
