import { NextResponse } from "next/server";
import { setAdminSession, verifyAdminPassword } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: string };

  if (!body.password || !verifyAdminPassword(body.password)) {
    return NextResponse.json({ message: "后台密码不正确" }, { status: 401 });
  }

  await setAdminSession();
  return NextResponse.json({ ok: true });
}
