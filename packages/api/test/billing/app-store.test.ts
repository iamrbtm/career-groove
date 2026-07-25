import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import type { ApiConfig } from "../../src/config.js";
import type { Database } from "../../src/db.js";
import type { AppStoreVerifier } from "../../src/domains/billing/app-store-routes.js";
import type { SessionService } from "../../src/domains/auth/session-service.js";

const userId = "987b1606-803f-481d-8f08-2737252a3dd0";
const config: ApiConfig = {
  allowedOrigins: ["https://careergroove.example"],
  bodyLimitBytes: 1_024 * 1_024,
  databaseUrl: "postgresql://unused",
  internalWorkerSecret: "test-worker-secret-at-least-32-characters",
  nodeEnv: "test",
  port: 3_001,
  providerEncryptionKey: "test-provider-key-at-least-32-characters",
};
const sessions = {
  userIdForAccessToken: vi.fn().mockResolvedValue(userId),
} as unknown as SessionService;

describe("App Store billing", () => {
  it("rejects a valid transaction bound to another account", async () => {
    const query = vi.fn();
    const appStore = {
      verifyTransaction: vi.fn().mockResolvedValue({
        environment: "Sandbox",
        transaction: {
          appAccountToken: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
          expiresDate: Date.now() + 86_400_000,
          originalTransactionId: "original-1",
          productId: "website.careergroove.app.pro.monthly",
          transactionId: "transaction-1",
        },
      }),
    } as unknown as AppStoreVerifier;
    const response = await createApp({
      appStore,
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request("/api/mobile/storekit/transactions", {
      body: JSON.stringify({ signedTransaction: "x".repeat(120) }),
      headers: {
        Authorization: `Bearer cg_access_${"a".repeat(43)}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    expect(response.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it("acknowledges duplicate signed notifications without applying twice", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const appStore = {
      verifyNotification: vi.fn().mockResolvedValue({
        environment: "Production",
        notification: {
          notificationType: "DID_RENEW",
          notificationUUID: "notification-1",
        },
        transaction: {
          appAccountToken: userId,
          originalTransactionId: "original-1",
          productId: "website.careergroove.app.pro.monthly",
        },
      }),
    } as unknown as AppStoreVerifier;
    const response = await createApp({
      appStore,
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request("/api/webhooks/app-store", {
      body: JSON.stringify({ signedPayload: "x".repeat(120) }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(204);
    expect(query).toHaveBeenCalledOnce();
  });
});
