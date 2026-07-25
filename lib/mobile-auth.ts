import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACCESS_PREFIX = "cg_access_";
const REFRESH_PREFIX = "cg_refresh_";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function token(prefix: string) {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

export type MobileTokenPair = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
};

export async function createMobileSession(
  userId: string,
  details: { deviceName?: string; platform?: string } = {},
): Promise<MobileTokenPair> {
  const accessToken = token(ACCESS_PREFIX);
  const refreshToken = token(REFRESH_PREFIX);
  const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TTL_MS);
  const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await db.query(
    `INSERT INTO mobile_sessions
      (user_id,access_token_hash,refresh_token_hash,access_expires_at,refresh_expires_at,device_name,platform)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [
      userId,
      digest(accessToken),
      digest(refreshToken),
      accessTokenExpiresAt,
      refreshTokenExpiresAt,
      details.deviceName?.slice(0, 120) || null,
      details.platform?.slice(0, 40) || "ios",
    ],
  );

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
    refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
  };
}

export async function userIdForAccessToken(value: string | null) {
  if (!value?.startsWith(ACCESS_PREFIX) || value.length > 256) return null;
  const result = await db.query<{ user_id: string }>(
    `UPDATE mobile_sessions
     SET last_used_at=now()
     WHERE access_token_hash=$1 AND revoked_at IS NULL AND access_expires_at > now()
       AND refresh_expires_at > now()
     RETURNING user_id`,
    [digest(value)],
  );
  return result.rows[0]?.user_id ?? null;
}

export async function rotateMobileSession(value: string): Promise<MobileTokenPair | null> {
  if (!value.startsWith(REFRESH_PREFIX) || value.length > 256) return null;
  const accessToken = token(ACCESS_PREFIX);
  const refreshToken = token(REFRESH_PREFIX);
  const accessTokenExpiresAt = new Date(Date.now() + ACCESS_TTL_MS);
  const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  const result = await db.query(
    `UPDATE mobile_sessions
     SET access_token_hash=$2,previous_refresh_token_hash=refresh_token_hash,
       refresh_token_hash=$3,access_expires_at=$4,
       refresh_expires_at=$5,last_used_at=now(),updated_at=now()
     WHERE refresh_token_hash=$1 AND revoked_at IS NULL AND refresh_expires_at > now()
     RETURNING id`,
    [digest(value), digest(accessToken), digest(refreshToken), accessTokenExpiresAt, refreshTokenExpiresAt],
  );
  if (!result.rowCount) {
    await db.query(
      `UPDATE mobile_sessions SET revoked_at=now(),updated_at=now()
       WHERE previous_refresh_token_hash=$1 AND revoked_at IS NULL`,
      [digest(value)],
    );
    return null;
  }

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
    refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
  };
}

export async function revokeMobileSession(refreshToken: string) {
  if (!refreshToken.startsWith(REFRESH_PREFIX) || refreshToken.length > 256) return;
  await db.query(
    "UPDATE mobile_sessions SET revoked_at=now(),updated_at=now() WHERE refresh_token_hash=$1",
    [digest(refreshToken)],
  );
}

export function bearerToken(header: string | null) {
  const match = header?.match(/^Bearer ([A-Za-z0-9_-]+)$/);
  return match?.[1] ?? null;
}

export function hashAuthIdentifier(value: string) {
  return digest(value.trim().toLowerCase());
}
