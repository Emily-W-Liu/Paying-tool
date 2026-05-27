import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const cookieName = "event-pay-admin";
const oneWeek = 60 * 60 * 24 * 7;

function getAdminPassword() {
  if (process.env.ADMIN_PASSWORD) {
    return process.env.ADMIN_PASSWORD;
  }

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return "admin123";
}

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET ?? getAdminPassword() ?? "dev-secret";
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

function createSessionValue() {
  const payload = `admin.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

function verifySessionValue(value?: string) {
  if (!value) return false;

  const parts = value.split(".");
  if (parts.length !== 3) return false;

  const payload = `${parts[0]}.${parts[1]}`;
  const expected = sign(payload);
  const received = parts[2];

  if (expected.length !== received.length) return false;

  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export function verifyAdminPassword(password: string) {
  const adminPassword = getAdminPassword();
  if (!adminPassword) return false;

  return password === adminPassword;
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  return verifySessionValue(cookieStore.get(cookieName)?.value);
}

export async function setAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(cookieName, createSessionValue(), {
    httpOnly: true,
    maxAge: oneWeek,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export function adminAuthError() {
  return Response.json({ message: "需要商家登录" }, { status: 401 });
}

export function hasProductionAdminPassword() {
  return Boolean(process.env.ADMIN_PASSWORD);
}
