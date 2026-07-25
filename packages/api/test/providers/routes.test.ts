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
const headers = {
  Authorization: `Bearer cg_access_${"a".repeat(43)}`,
  "Content-Type": "application/json",
};

describe("provider routes", () => {
  it("never returns encrypted provider keys", async () => {
    const database = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            active: true,
            availableModels: ["gpt-4.1"],
            encrypted_api_key: "must-not-leak",
            id: "provider-1",
            keyHint: "…cret",
            provider: "openai",
          },
        ],
      }),
    } as unknown as Database;
    const response = await createApp({ config, database, sessions }).request(
      "/api/providers",
      { headers },
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).not.toContain("must-not-leak");
    expect(body).toContain("keyHint");
  });

  it("does not accept a caller-controlled model-discovery URL", async () => {
    const query = vi.fn();
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request("/api/providers", {
      body: JSON.stringify({
        action: "connect",
        apiKey: "ollama",
        baseUrl: "http://169.254.169.254/latest/meta-data",
        provider: "ollama",
      }),
      headers,
      method: "POST",
    });

    expect(response.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});
