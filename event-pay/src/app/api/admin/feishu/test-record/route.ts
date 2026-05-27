import { NextResponse } from "next/server";
import { adminAuthError, isAdminAuthenticated } from "@/lib/admin-auth";
import { createFeishuTestRecord } from "@/lib/feishu";

export const runtime = "nodejs";

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return adminAuthError();
  }

  const result = await createFeishuTestRecord();
  const ok = result.status === "synced";

  return NextResponse.json(result, { status: ok ? 201 : 400 });
}
