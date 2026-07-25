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

describe("application portability", () => {
  it("neutralizes spreadsheet formulas in CSV exports", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [{ title: "=HYPERLINK(\"https://bad\")", company: "Acme" }],
    });
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request("/api/applications/export", { headers });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain(`"'=HYPERLINK`);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("user_id=$1"), [
      userId,
    ]);
  });

  it("rejects oversized CSV imports before touching the database", async () => {
    const query = vi.fn();
    const csv = `title,company\n${Array.from({ length: 501 }, (_, index) => `Role ${index},Acme`).join("\n")}`;
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request("/api/applications/import", {
      body: JSON.stringify({ csv }),
      headers,
      method: "POST",
    });
    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});
