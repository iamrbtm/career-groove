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
const userId = "987b1606-803f-481d-8f08-2737252a3dd0";
const sessions = {
  userIdForAccessToken: vi.fn().mockResolvedValue(userId),
} as unknown as SessionService;
const headers = {
  Authorization: `Bearer cg_access_${"a".repeat(43)}`,
  "Content-Type": "application/json",
};

describe("account routes", () => {
  it("registers normalized credentials with a non-plaintext password", async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ id: userId, name: "Ada", email: "ada@example.com" }],
    });
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: " Ada ",
        email: "ADA@EXAMPLE.COM",
        password: "analytical42",
      }),
    });

    expect(response.status).toBe(201);
    const parameters = query.mock.calls[0]?.[1] as string[];
    expect(parameters.slice(0, 2)).toEqual(["Ada", "ada@example.com"]);
    expect(parameters[2]).toMatch(/^\$2[aby]\$/);
    expect(parameters[2]).not.toContain("analytical42");
  });

  it("updates only the authenticated user's validated profile", async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ id: userId, name: "Ada Lovelace", phone: "" }],
    });
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request("/api/profile", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ name: " Ada Lovelace ", phone: "" }),
    });

    expect(response.status).toBe(200);
    expect(query.mock.calls[0]?.[1]).toEqual([
      userId,
      "Ada Lovelace",
      "",
    ]);
    expect(await response.json()).toEqual({
      profile: { id: userId, name: "Ada Lovelace", phone: "" },
    });
  });

  it("derives the active billing source without trusting the client", async () => {
    const expiry = new Date(Date.now() + 86_400_000).toISOString();
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          appStoreExpiresAt: expiry,
          appStoreProductId: "website.careergroove.pro.monthly",
          stripeCurrentPeriodEnd: null,
          stripeStatus: "canceled",
        },
      ],
    });
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request("/api/mobile/billing/status", { headers });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      source: "app_store",
      status: "active",
      productId: "website.careergroove.pro.monthly",
    });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE id=$1"), [
      userId,
    ]);
  });

  it("stores an APNs device token with a one-way lookup hash", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    const token = "A".repeat(64);
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request("/api/mobile/push-devices", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        deviceToken: token,
        environment: "production",
        enabledCategories: ["interview_reminder", "document_status"],
      }),
    });

    expect(response.status).toBe(204);
    const parameters = query.mock.calls[0]?.[1] as string[];
    expect(parameters[0]).toBe(userId);
    expect(parameters[1]).toMatch(/^[a-f0-9]{64}$/);
    expect(parameters[1]).not.toBe(token.toLowerCase());
    expect(parameters[2]).toBe(token.toLowerCase());
  });
});
