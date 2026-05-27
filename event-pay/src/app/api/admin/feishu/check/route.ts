import { NextResponse } from "next/server";
import { adminAuthError, isAdminAuthenticated } from "@/lib/admin-auth";
import { checkFeishuConnection } from "@/lib/feishu";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return adminAuthError();
  }

  const result = await checkFeishuConnection();
  return NextResponse.json(result);
}
