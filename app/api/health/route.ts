import { db } from "@/lib/db";
import Redis from "ioredis";

export async function GET() {
  const checks: Record<string, string> = {};
  let healthy = true;

  try {
    await db.query("SELECT 1");
    checks.db = "ok";
  } catch {
    checks.db = "unreachable";
    healthy = false;
  }

  let redis: Redis | null = null;
  try {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
      lazyConnect: false,
    });
    const pong = await redis.ping();
    checks.redis = pong === "PONG" ? "ok" : "unreachable";
    if (pong !== "PONG") healthy = false;
  } catch {
    checks.redis = "unreachable";
    healthy = false;
  } finally {
    redis?.disconnect();
  }

  return Response.json(
    healthy ? { status: "ok", checks } : { status: "degraded", checks },
    { status: healthy ? 200 : 503 },
  );
}
