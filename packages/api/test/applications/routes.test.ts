import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import type { ApiConfig } from "../../src/config.js";
import type { Database } from "../../src/db.js";
import type { SessionService } from "../../src/domains/auth/session-service.js";

const userId = "987b1606-803f-481d-8f08-2737252a3dd0";
const applicationId = "04b7b02a-5d7e-4b39-a054-3d78f38238ac";
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
const row = {
  id: applicationId,
  status: "saved",
  title: "Engineer",
  company: "Acme",
  description: "Build useful things",
};

describe("application routes", () => {
  it("lists only the authenticated user's active applications", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [row] });
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request("/api/applications", { headers });

    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("a.user_id=$1"), [
      userId,
    ]);
    expect(await response.json()).toEqual({ applications: [row] });
  });

  it("atomically creates an application and its initial event", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [row] });
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request("/api/applications", {
      body: JSON.stringify({
        company: "Acme",
        description: "Build useful things",
        title: "Engineer",
      }),
      headers,
      method: "POST",
    });

    expect(response.status).toBe(201);
    expect(query.mock.calls[0]?.[0]).toContain("WITH inserted AS");
    expect(query.mock.calls[0]?.[0]).toContain("INSERT INTO application_events");
    expect(query.mock.calls[0]?.[1]?.[0]).toBe(userId);
  });

  it("uses an allowlisted column map for partial updates", async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ ...row, status: "applied" }],
    });
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request(`/api/applications/${applicationId}`, {
      body: JSON.stringify({ status: "applied" }),
      headers,
      method: "PATCH",
    });

    expect(response.status).toBe(200);
    expect(query.mock.calls[0]?.[0]).toContain("status=$3");
    expect(query.mock.calls[0]?.[0]).not.toContain("applied'");
    expect(query.mock.calls[0]?.[1]).toEqual([applicationId, userId, "applied"]);
  });
});
