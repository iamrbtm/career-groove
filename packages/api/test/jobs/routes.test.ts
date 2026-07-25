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

const row = {
  id: "04b7b02a-5d7e-4b39-a054-3d78f38238ac",
  user_id: "987b1606-803f-481d-8f08-2737252a3dd0",
  company: "Acme",
  title: "Engineer",
  location: null,
  started_on: "2025-01-01",
  ended_on: null,
  current: true,
  raw_notes: null,
  achievements: [],
  metadata: {},
  created_at: new Date("2025-01-01T00:00:00.000Z"),
  updated_at: new Date("2025-01-01T00:00:00.000Z"),
};

function sessions(userId: string | null) {
  return {
    userIdForAccessToken: vi.fn().mockResolvedValue(userId),
  } as unknown as SessionService;
}

describe("jobs routes", () => {
  it("requires a valid access token", async () => {
    const response = await createApp({
      config,
      database: { query: vi.fn() } as unknown as Database,
      sessions: sessions(null),
    }).request("/api/jobs");

    expect(response.status).toBe(401);
  });

  it("scopes list queries to the authenticated user and serializes rows", async () => {
    const database = {
      query: vi.fn().mockResolvedValue({ rows: [row], rowCount: 1 }),
    } as unknown as Database & { query: ReturnType<typeof vi.fn> };
    const response = await createApp({
      config,
      database,
      sessions: sessions(row.user_id),
    }).request("/api/jobs", {
      headers: { Authorization: `Bearer cg_access_${"a".repeat(43)}` },
    });

    expect(response.status).toBe(200);
    expect(database.query.mock.calls[0]?.[1]).toEqual([row.user_id]);
    expect(await response.json()).toMatchObject({
      jobs: [{ id: row.id, userId: row.user_id, startedOn: "2025-01-01" }],
    });
  });

  it("creates jobs with parameterized values", async () => {
    const database = {
      query: vi.fn().mockResolvedValue({ rows: [row], rowCount: 1 }),
    } as unknown as Database & { query: ReturnType<typeof vi.fn> };
    const response = await createApp({
      config,
      database,
      sessions: sessions(row.user_id),
    }).request("/api/jobs", {
      method: "POST",
      headers: {
        Authorization: `Bearer cg_access_${"a".repeat(43)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company: "Acme",
        current: true,
        startedOn: "2025-01-01",
        title: "Engineer",
      }),
    });

    expect(response.status).toBe(201);
    expect(database.query.mock.calls[0]?.[0]).not.toContain("Acme");
    expect(database.query.mock.calls[0]?.[1]?.[0]).toBe(row.user_id);
  });
});
