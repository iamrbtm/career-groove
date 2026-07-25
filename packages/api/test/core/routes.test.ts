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

const sessions = {
  userIdForAccessToken: vi.fn().mockResolvedValue(
    "987b1606-803f-481d-8f08-2737252a3dd0",
  ),
} as unknown as SessionService;

const authorization = {
  Authorization: `Bearer cg_access_${"a".repeat(43)}`,
  "Content-Type": "application/json",
};

describe("core career routes", () => {
  it("creates a normalized contact with tenant-scoped parameters", async () => {
    const database = {
      query: vi.fn().mockResolvedValue({
        rowCount: 1,
        rows: [{ id: "contact-1", name: "Ada", email: null }],
      }),
    } as unknown as Database & { query: ReturnType<typeof vi.fn> };
    const response = await createApp({ config, database, sessions }).request(
      "/api/contacts",
      {
        method: "POST",
        headers: authorization,
        body: JSON.stringify({ name: " Ada ", email: "" }),
      },
    );

    expect(response.status).toBe(201);
    expect(database.query.mock.calls[0]?.[1]?.slice(0, 3)).toEqual([
      "987b1606-803f-481d-8f08-2737252a3dd0",
      null,
      "Ada",
    ]);
  });

  it("returns 404 when a tenant-scoped delete affects no residence", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 0, rows: [] });
    const database = {
      query,
    } as unknown as Database;
    const response = await createApp({ config, database, sessions }).request(
      "/api/residences/04b7b02a-5d7e-4b39-a054-3d78f38238ac",
      { method: "DELETE", headers: authorization },
    );

    expect(response.status).toBe(404);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("user_id=$2"),
      [
        "04b7b02a-5d7e-4b39-a054-3d78f38238ac",
        "987b1606-803f-481d-8f08-2737252a3dd0",
      ],
    );
  });

  it("rejects an empty settings update before querying", async () => {
    const query = vi.fn();
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request("/api/settings", {
      method: "PATCH",
      headers: authorization,
      body: "{}",
    });

    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});
