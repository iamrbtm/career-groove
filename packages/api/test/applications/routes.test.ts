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

  it("links a contact only through an authenticated application CTE", async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ id: "link-1", name: "Grace Hopper" }],
    });
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request(`/api/applications/${applicationId}/contacts`, {
      body: JSON.stringify({ name: "Grace Hopper", relationship: "mentor" }),
      headers,
      method: "POST",
    });

    expect(response.status).toBe(201);
    expect(query.mock.calls[0]?.[0]).toContain("WHERE id=$1 AND user_id=$2");
    expect(query.mock.calls[0]?.[1]?.slice(0, 2)).toEqual([
      applicationId,
      userId,
    ]);
  });

  it("records a submission and event in one statement", async () => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ id: applicationId, status: "applied" }],
    });
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request(`/api/applications/${applicationId}/submission`, {
      body: JSON.stringify({ confirmationNumber: "ABC-42" }),
      headers,
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(query.mock.calls[0]?.[0]).toContain("WITH updated AS");
    expect(query.mock.calls[0]?.[0]).toContain("application_events");
  });

  it.each([
    ["documents", { kind: "resume", title: "Platform resume" }],
    ["interviews", { roundType: "technical", prepStatus: "prepping" }],
    ["outcomes", { outcome: "offer", userNote: "Strong team" }],
  ])("creates tenant-scoped application %s", async (resource, body) => {
    const query = vi.fn().mockResolvedValue({
      rowCount: 1,
      rows: [{ id: `${resource}-1` }],
    });
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request(`/api/applications/${applicationId}/${resource}`, {
      body: JSON.stringify(body),
      headers,
      method: "POST",
    });

    expect(response.status).toBe(201);
    expect(query.mock.calls[0]?.[0]).toContain("WHERE id=$1 AND user_id=$2");
    expect(query.mock.calls[0]?.[1]?.slice(0, 2)).toEqual([
      applicationId,
      userId,
    ]);
  });

  it("builds a deterministic remix from only owned career evidence", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: applicationId, title: "Platform Engineer", company: "Acme", description: "Docker PostgreSQL systems" }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: "job-1", title: "Engineer", company: "Past", achievements: ["Built Docker systems"], rawNotes: "" }],
      })
      .mockResolvedValueOnce({ rows: [{ name: "PostgreSQL" }] })
      .mockResolvedValueOnce({ rows: [] });
    const response = await createApp({
      config,
      database: { query } as unknown as Database,
      sessions,
    }).request(`/api/applications/${applicationId}/remix`, {
      headers,
      method: "POST",
    });
    expect(response.status).toBe(200);
    expect(query.mock.calls[0]?.[1]).toEqual([applicationId, userId]);
    expect(query.mock.calls[3]?.[0]).toContain("user_id=$2");
  });
});
