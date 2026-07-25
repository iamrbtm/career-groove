import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../src/app.js";
import type { ApiConfig } from "../../src/config.js";
import type { Database } from "../../src/db.js";
import { SecretBox } from "../../src/domains/providers/secret-box.js";
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
  userIdForAccessToken: vi.fn().mockResolvedValue("user-1"),
} as unknown as SessionService;

describe("AI routes", () => {
  it("uses the stored model and encrypted key with a cancellable timeout", async () => {
    const encrypted = new SecretBox(config.providerEncryptionKey).encrypt("sk-secret");
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ preferences: { aiProvider: "openai" } }] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            encrypted_api_key: encrypted,
            provider: "openai",
            selected_model: "gpt-test",
          },
        ],
      });
    const transport = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "Useful answer" } }] }),
        { status: 200 },
      ),
    );
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      fetch: transport,
      sessions,
    }).request("/api/ai", {
      body: JSON.stringify({
        messages: [{ role: "user", content: "Help me prepare" }],
        purpose: "mock-interview",
      }),
      headers: {
        Authorization: `Bearer cg_access_${"a".repeat(43)}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("Useful answer");
    expect(transport).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer sk-secret" }),
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
