import IORedis from "ioredis";

let client: IORedis | null = null;

function getClient(): IORedis {
  if (!client) {
    client = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return client;
}

export function windowKey(prefix: string, nowMs: number, windowMs: number): string {
  return `rl:${prefix}:${Math.floor(nowMs / windowMs)}`;
}

let warnedDown = false;

export async function limitRequest(key: string, max: number, windowMs: number): Promise<boolean> {
  try {
    const redis = getClient();
    const bucket = windowKey(key, Date.now(), windowMs);
    const count = await redis.incr(bucket);
    if (count === 1) await redis.pexpire(bucket, windowMs);
    return count <= max;
  } catch (error) {
    if (!warnedDown) {
      warnedDown = true;
      console.error("Rate limiter unavailable, failing open", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return true;
  }
}

export function limitMax(envName: string, fallback: number): number {
  const raw = Number(process.env[envName]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}
