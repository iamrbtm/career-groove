import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

const config = {
  allowedOrigins: ["https://careergroove.example"],
  bodyLimitBytes: 1_024,
  databaseUrl: "postgresql://unused",
  internalWorkerSecret: "test-worker-secret-at-least-32-characters",
  nodeEnv: "test" as const,
  port: 3_001,
  providerEncryptionKey: "test-provider-key-at-least-32-characters",
};

describe("API foundation", () => {
  it("normalizes empty optional production variables to unavailable features", () => {
    const loaded = loadConfig({
      ALLOWED_ORIGINS: "https://careergroove.example",
      AUTH_GITHUB_ID: "",
      AUTH_GITHUB_SECRET: "  ",
      AUTH_GOOGLE_ID: "",
      AUTH_GOOGLE_SECRET: "",
      DATABASE_URL: "postgresql://unused",
      INTERNAL_WORKER_SECRET: "test-worker-secret-at-least-32-characters",
      NODE_ENV: "production",
      PROVIDER_ENCRYPTION_KEY: "test-provider-key-at-least-32-characters",
    });

    expect(loaded).toMatchObject({
      githubClientId: undefined,
      githubClientSecret: undefined,
      googleClientId: undefined,
      googleClientSecret: undefined,
    });
  });

  it("reports health without exposing infrastructure details", async () => {
    const response = await createApp({ config }).request("/api/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      service: "career-groove-api",
    });
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("allows only configured CORS origins with credentials", async () => {
    const app = createApp({ config });
    const allowed = await app.request("/api/health", {
      headers: { Origin: "https://careergroove.example" },
    });
    const denied = await app.request("/api/health", {
      headers: { Origin: "https://attacker.example" },
    });

    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      "https://careergroove.example",
    );
    expect(allowed.headers.get("access-control-allow-credentials")).toBe("true");
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns a stable structured error for unknown routes", async () => {
    const response = await createApp({ config }).request("/api/unknown");
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({
      error: {
        code: "not_found",
        message: "Route not found",
        requestId: response.headers.get("x-request-id"),
      },
    });
  });

  it("rejects bodies over the configured maximum", async () => {
    const response = await createApp({ config }).request("/api/unknown", {
      method: "POST",
      headers: {
        "Content-Length": "2048",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: "x".repeat(2_000) }),
    });

    expect(response.status).toBe(413);
  });
});
