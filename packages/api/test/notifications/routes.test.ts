import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import type { ApiConfig } from "../../src/config.js";
import type { Database } from "../../src/db.js";

const secret = "test-worker-secret-at-least-32-characters";
const config: ApiConfig = {
  allowedOrigins: ["https://careergroove.example"],
  bodyLimitBytes: 1_048_576,
  databaseUrl: "postgresql://unused",
  internalWorkerSecret: secret,
  nodeEnv: "test",
  port: 3_001,
  providerEncryptionKey: "test-provider-key-at-least-32-characters",
};

describe("mobile notification worker route", () => {
  it("rejects requests before querying candidate notifications", async () => {
    const query = vi.fn();
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
    }).request("/api/internal/mobile-notifications", { method: "POST" });

    expect(response.status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });

  it("returns an empty authenticated delivery batch", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
    }).request("/api/internal/mobile-notifications", {
      headers: { Authorization: `Bearer ${secret}` },
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      candidates: 0,
      failed: 0,
      sent: 0,
    });
  });
});
