import { z } from "zod";
import { revokeMobileSession } from "@/lib/mobile-auth";

const inputSchema = z.object({ refreshToken: z.string().min(32).max(256) });

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (parsed.success) await revokeMobileSession(parsed.data.refreshToken);
  return new Response(null, { status: 204 });
}
