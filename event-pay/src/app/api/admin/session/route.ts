import { NextResponse } from "next/server";
import {
  hasProductionAdminPassword,
  isAdminAuthenticated,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET() {
  const authenticated = await isAdminAuthenticated();

  return NextResponse.json({
    authenticated,
    isUsingDevPassword:
      process.env.NODE_ENV !== "production" && !hasProductionAdminPassword(),
  });
}
