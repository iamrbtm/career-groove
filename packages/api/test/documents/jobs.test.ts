import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import type { ApiConfig } from "../../src/config.js";
import type { Database } from "../../src/db.js";
import type { SessionService } from "../../src/domains/auth/session-service.js";

const userId = "987b1606-803f-481d-8f08-2737252a3dd0";
const jobId = "04b7b02a-5d7e-4b39-a054-3d78f38238ac";
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

describe("document generation jobs", () => {
  it("queues a self-contained career snapshot for direct targets", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ name: "Ada", email: "a@example.com" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: jobId, status: "queued" }] });
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request("/api/document-jobs", {
      body: JSON.stringify({
        kind: "resume",
        target: {
          company: "Analytical Engines",
          description: "Build precise systems",
          title: "Engineer",
        },
      }),
      headers,
      method: "POST",
    });

    expect(response.status).toBe(202);
    expect(query.mock.calls[5]?.[0]).toContain("document_generation_jobs");
    expect(query.mock.calls[5]?.[1]?.[0]).toBe(userId);
  });

  it("clones a prior owned job for safe reprocessing", async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ id: "new-job", status: "queued" }],
    });
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request(`/api/document-jobs/${jobId}/reprocess`, {
      headers,
      method: "POST",
    });
    expect(response.status).toBe(202);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("user_id=$2"), [
      jobId,
      userId,
    ]);
  });
});
