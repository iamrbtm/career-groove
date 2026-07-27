import { auth } from "@/auth";
import { headers } from "next/headers";
import { bearerToken, userIdForAccessToken } from "@/lib/mobile-auth";
import { db } from "./db";

export async function requireUser() {
  const session = await auth();
  if (session?.user?.id) return session.user.id;
  const requestHeaders = await headers();
  return userIdForAccessToken(bearerToken(requestHeaders.get("authorization")));
}

export function unauthorized() { return Response.json({ error: "Unauthorized" }, { status: 401 }); }

export async function getUserTier(userId: string): Promise<"free" | "pro"> {
  const result = await db.query(
    `SELECT "subscriptionStatus" FROM users WHERE id = $1`,
    [userId],
  );
  const status = result.rows[0]?.subscriptionStatus;
  if (!status || status === "inactive" || status === "past_due" || status === "unpaid")
    return "free";
  return "pro";
}

export async function isAdmin(userId: string): Promise<boolean> {
  const result = await db.query("SELECT 1 FROM admins WHERE user_id = $1", [userId]);
  return (result.rowCount ?? 0) > 0;
}

export async function getSetting(key: string): Promise<Record<string, unknown> | null> {
  const result = await db.query("SELECT value FROM settings WHERE key = $1", [key]);
  return result.rows[0]?.value ?? null;
}

export function forbidden() {
  return Response.json({ error: "Upgrade to Pro to use this feature." }, { status: 403 });
}
