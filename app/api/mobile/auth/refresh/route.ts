import { z } from "zod";
import { rotateMobileSession } from "@/lib/mobile-auth";

const inputSchema = z.object({ refreshToken: z.string().min(32).max(256) });

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid refresh token" }, { status: 401 });
  const tokens = await rotateMobileSession(parsed.data.refreshToken);
  if (!tokens) return Response.json({ error: "Invalid refresh token" }, { status: 401 });
  return Response.json(tokens, { headers: { "Cache-Control": "no-store" } });
}
