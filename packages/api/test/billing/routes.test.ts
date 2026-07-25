import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import type { ApiConfig } from "../../src/config.js";
import type { Database } from "../../src/db.js";
import type { SessionService } from "../../src/domains/auth/session-service.js";
import type { StripeClient } from "../../src/domains/billing/routes.js";

const baseConfig: ApiConfig = {
  allowedOrigins: ["https://careergroove.example"],
  bodyLimitBytes: 1_024 * 1_024,
  databaseUrl: "postgresql://unused",
  internalWorkerSecret: "test-worker-secret-at-least-32-characters",
  nodeEnv: "test",
  port: 3_001,
  providerEncryptionKey: "test-provider-key-at-least-32-characters",
  stripePriceMonthly: "price_monthly",
  stripeSecretKey: "sk_test_example",
  stripeWebhookSecret: "whsec_example",
};
const userId = "987b1606-803f-481d-8f08-2737252a3dd0";
const sessions = {
  userIdForAccessToken: vi.fn().mockResolvedValue(userId),
} as unknown as SessionService;
const headers = {
  Authorization: `Bearer cg_access_${"a".repeat(43)}`,
  "Content-Type": "application/json",
};

describe("billing routes", () => {
  it("creates checkout for the authenticated account and configured price only", async () => {
    const database = {
      query: vi
        .fn()
        .mockResolvedValueOnce({
          rows: [{ email: "ada@example.com", stripeCustomerId: "cus_123" }],
        }),
    } as unknown as Database;
    const stripe = {
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.test/1" }),
        },
      },
    } as unknown as StripeClient;
    const response = await createApp({
      config: baseConfig,
      database,
      sessions,
      stripe,
    }).request("/api/stripe/checkout", {
      body: JSON.stringify({ plan: "monthly" }),
      headers,
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_123",
        line_items: [{ price: "price_monthly", quantity: 1 }],
      }),
    );
  });

  it("rejects a webhook before database access when signature verification fails", async () => {
    const query = vi.fn();
    const stripe = {
      webhooks: {
        constructEvent: vi.fn(() => {
          throw new Error("bad signature");
        }),
      },
    } as unknown as StripeClient;
    const response = await createApp({
      config: baseConfig,
      database: { query } as unknown as Database,
      sessions,
      stripe,
    }).request("/api/webhooks/stripe", {
      body: "{}",
      headers: { "stripe-signature": "invalid" },
      method: "POST",
    });

    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it("does not delete an account when subscription cancellation fails", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ stripeSubscriptionId: "sub_123" }],
    });
    const stripe = {
      subscriptions: {
        cancel: vi.fn().mockRejectedValue(new Error("Stripe unavailable")),
      },
    } as unknown as StripeClient;
    const response = await createApp({
      config: baseConfig,
      database: { query } as unknown as Database,
      sessions,
      stripe,
    }).request("/api/mobile/account", {
      body: JSON.stringify({ confirmation: "DELETE" }),
      headers,
      method: "DELETE",
    });

    expect(response.status).toBe(503);
    expect(query).toHaveBeenCalledOnce();
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM users"),
      expect.anything(),
    );
  });
});
