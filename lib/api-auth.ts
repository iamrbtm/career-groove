import { auth } from "@/auth";
import { headers } from "next/headers";
import { bearerToken, userIdForAccessToken } from "@/lib/mobile-auth";

export async function requireUser() {
  const session = await auth();
  if (session?.user?.id) return session.user.id;
  const requestHeaders = await headers();
  return userIdForAccessToken(bearerToken(requestHeaders.get("authorization")));
}

export function unauthorized() { return Response.json({ error: "Unauthorized" }, { status: 401 }); }
