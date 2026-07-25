import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import type { ApiConfig } from "../../src/config.js";
import type { Database } from "../../src/db.js";
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
const headers = {
  Authorization: `Bearer cg_access_${"a".repeat(43)}`,
  "Content-Type": "application/json",
};

describe("application support routes", () => {
  it("computes analytics from tenant-scoped queries", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ interviewsActive: 2, submittedCount: 4, total: 8 }],
      })
      .mockResolvedValue({ rows: [] });
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request("/api/application-analytics", { headers });

    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledTimes(4);
    for (const call of query.mock.calls) expect(call[1]).toEqual([userId]);
    expect(await response.json()).toMatchObject({
      summary: { interviewRate: 50, responseRate: 25 },
    });
  });

  it("rejects invalid application preferences before querying", async () => {
    const query = vi.fn();
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request("/api/application-preferences", {
      body: JSON.stringify({ weeklyPace: 500 }),
      headers,
      method: "PATCH",
    });

    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});
