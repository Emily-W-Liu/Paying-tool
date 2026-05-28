import { NextResponse } from "next/server";
import {
  hasProductionAdminPassword,
  refreshAdminSession,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET() {
  const authenticated = await refreshAdminSession();

  return NextResponse.json({
    authenticated,
    isUsingDevPassword:
      process.env.NODE_ENV !== "production" && !hasProductionAdminPassword(),
  });
}
