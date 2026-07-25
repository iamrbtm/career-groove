import { createHash, randomBytes } from "node:crypto";

import type { TokenPair } from "@career-groove/shared";

import type { Database } from "../../db.js";

const ACCESS_PREFIX = "cg_access_";
const REFRESH_PREFIX = "cg_refresh_";
const ACCESS_TTL_MS = 15 * 60 * 1_000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function validToken(value: string, prefix: string): boolean {
  return (
    value.startsWith(prefix) &&
    value.length <= 256 &&
    TOKEN_PATTERN.test(value)
  );
}

export function bearerToken(header: string | null | undefined): string | null {
  const match = header?.match(/^Bearer ([A-Za-z0-9_-]+)$/);
  const value = match?.[1];
  return value && validToken(value, ACCESS_PREFIX) ? value : null;
}

export function hashAuthIdentifier(value: string): string {
  return digest(value.trim().toLowerCase());
}

export interface SessionDetails {
  deviceName?: string;
  platform?: "ios" | "android" | "web";
}

interface SessionServiceOptions {
  now?: () => Date;
  randomToken?: () => string;
}

export class SessionService {
  readonly #database: Database;
  readonly #now: () => Date;
  readonly #randomToken: () => string;

  constructor(database: Database, options: SessionServiceOptions = {}) {
    this.#database = database;
    this.#now = options.now ?? (() => new Date());
    this.#randomToken =
      options.randomToken ?? (() => randomBytes(32).toString("base64url"));
  }

  async create(userId: string, details: SessionDetails = {}): Promise<TokenPair> {
    const accessToken = `${ACCESS_PREFIX}${this.#randomToken()}`;
    const refreshToken = `${REFRESH_PREFIX}${this.#randomToken()}`;
    const now = this.#now();
    const accessTokenExpiresAt = new Date(now.getTime() + ACCESS_TTL_MS);
    const refreshTokenExpiresAt = new Date(now.getTime() + REFRESH_TTL_MS);

    await this.#database.query(
      `INSERT INTO mobile_sessions
        (user_id,access_token_hash,refresh_token_hash,access_expires_at,
         refresh_expires_at,device_name,platform)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [
        userId,
        digest(accessToken),
        digest(refreshToken),
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
        details.deviceName?.slice(0, 120) || null,
        details.platform ?? "ios",
      ],
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
      refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    };
  }

  async userIdForAccessToken(value: string | null): Promise<string | null> {
    if (!value || !validToken(value, ACCESS_PREFIX)) return null;
    const result = await this.#database.query<{ user_id: string }>(
      `UPDATE mobile_sessions
       SET last_used_at=now()
       WHERE access_token_hash=$1 AND revoked_at IS NULL
         AND access_expires_at > now() AND refresh_expires_at > now()
       RETURNING user_id`,
      [digest(value)],
    );
    return result.rows[0]?.user_id ?? null;
  }

  async rotate(value: string): Promise<TokenPair | null> {
    if (!validToken(value, REFRESH_PREFIX)) return null;
    const accessToken = `${ACCESS_PREFIX}${this.#randomToken()}`;
    const refreshToken = `${REFRESH_PREFIX}${this.#randomToken()}`;
    const now = this.#now();
    const accessTokenExpiresAt = new Date(now.getTime() + ACCESS_TTL_MS);
    const refreshTokenExpiresAt = new Date(now.getTime() + REFRESH_TTL_MS);
    const valueDigest = digest(value);

    const result = await this.#database.query(
      `UPDATE mobile_sessions
       SET access_token_hash=$2,previous_refresh_token_hash=refresh_token_hash,
         refresh_token_hash=$3,access_expires_at=$4,refresh_expires_at=$5,
         last_used_at=now(),updated_at=now()
       WHERE refresh_token_hash=$1 AND revoked_at IS NULL
         AND refresh_expires_at > now()
       RETURNING id`,
      [
        valueDigest,
        digest(accessToken),
        digest(refreshToken),
        accessTokenExpiresAt,
        refreshTokenExpiresAt,
      ],
    );
    if (!result.rowCount) {
      await this.#database.query(
        `UPDATE mobile_sessions
         SET revoked_at=now(),updated_at=now()
         WHERE previous_refresh_token_hash=$1 AND revoked_at IS NULL`,
        [valueDigest],
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

  async revoke(refreshToken: string): Promise<void> {
    if (!validToken(refreshToken, REFRESH_PREFIX)) return;
    await this.#database.query(
      `UPDATE mobile_sessions
       SET revoked_at=now(),updated_at=now()
       WHERE refresh_token_hash=$1`,
      [digest(refreshToken)],
    );
  }
}
