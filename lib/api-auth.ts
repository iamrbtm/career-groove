import { auth } from "@/auth";

export async function requireUser() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export function unauthorized() { return Response.json({ error: "Unauthorized" }, { status: 401 }); }
