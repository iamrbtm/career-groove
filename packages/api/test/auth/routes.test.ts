import { hash } from "bcryptjs";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import type { ApiConfig } from "../../src/config.js";
import type { Database } from "../../src/db.js";
import type { SessionService } from "../../src/domains/auth/session-service.js";

const config: ApiConfig = {
  allowedOrigins: ["https://careergroove.example"],
  bodyLimitBytes: 1_024 * 1_024,
  databaseUrl: "postgresql://unused",
  internalWorkerSecret: "test-worker-secret-at-least-32-characters",
  nodeEnv: "test",
  port: 3_001,
  providerEncryptionKey: "test-provider-key-at-least-32-characters",
};

const tokens = {
  accessToken: `cg_access_${"a".repeat(43)}`,
  refreshToken: `cg_refresh_${"b".repeat(43)}`,
  accessTokenExpiresAt: "2026-07-25T12:15:00.000Z",
  refreshTokenExpiresAt: "2026-08-24T12:00:00.000Z",
};

function sessionStub() {
  return {
    create: vi.fn().mockResolvedValue(tokens),
    revoke: vi.fn().mockResolvedValue(undefined),
    rotate: vi.fn().mockResolvedValue(tokens),
    userIdForAccessToken: vi.fn().mockResolvedValue("user-1"),
  } as unknown as SessionService;
}

describe("authentication routes", () => {
  it("returns constant-shape invalid credential responses", async () => {
    const database = {
      query: vi.fn().mockResolvedValue({ rows: [{ count: 0 }], rowCount: 1 }),
    } as unknown as Database;
    const response = await createApp({
      config,
      database,
      sessions: sessionStub(),
    }).request("/api/mobile/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "incorrect" }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "invalid_credentials", message: "Invalid credentials" },
    });
  });

  it("issues a no-store token pair for valid credentials", async () => {
    const passwordHash = await hash("correct-horse-42", 4);
    const database = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("count(*)")) return { rows: [{ count: 0 }], rowCount: 1 };
        if (sql.includes("SELECT id,name,email,image,password_hash")) {
          return {
            rows: [
              {
                id: "user-1",
                name: "Ada",
                email: "user@example.com",
                image: null,
                password_hash: passwordHash,
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as Database;
    const sessions = sessionStub();
    const response = await createApp({ config, database, sessions }).request(
      "/api/mobile/auth/signin",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "203.0.113.4",
        },
        body: JSON.stringify({
          email: "USER@example.com",
          password: "correct-horse-42",
          platform: "android",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      ...tokens,
      user: { id: "user-1", email: "user@example.com" },
    });
    expect(sessions.create).toHaveBeenCalledWith("user-1", {
      deviceName: undefined,
      platform: "android",
    });
  });

  it("rotates and revokes refresh tokens", async () => {
    const sessions = sessionStub();
    const app = createApp({
      config,
      database: { query: vi.fn() } as unknown as Database,
      sessions,
    });
    const refresh = await app.request("/api/mobile/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
    const signout = await app.request("/api/mobile/auth/signout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    expect(refresh.status).toBe(200);
    expect(signout.status).toBe(204);
    expect(sessions.rotate).toHaveBeenCalledWith(tokens.refreshToken);
    expect(sessions.revoke).toHaveBeenCalledWith(tokens.refreshToken);
  });
});
