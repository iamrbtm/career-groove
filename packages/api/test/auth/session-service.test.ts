import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  bearerToken,
  SessionService,
} from "../../src/domains/auth/session-service.js";
import type { Database } from "../../src/db.js";

function databaseReturning(rows: unknown[] = [], rowCount = rows.length) {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount }),
  } as unknown as Database & { query: ReturnType<typeof vi.fn> };
}

describe("SessionService", () => {
  it("stores digests rather than plaintext tokens", async () => {
    const database = databaseReturning();
    const service = new SessionService(database, {
      now: () => new Date("2026-07-25T12:00:00.000Z"),
      randomToken: () => "fixed-random-value",
    });

    const pair = await service.create("987b1606-803f-481d-8f08-2737252a3dd0", {
      platform: "android",
    });

    expect(pair.accessToken).toBe("cg_access_fixed-random-value");
    expect(pair.refreshToken).toBe("cg_refresh_fixed-random-value");
    const values = database.query.mock.calls[0]?.[1] as unknown[];
    expect(values).not.toContain(pair.accessToken);
    expect(values).not.toContain(pair.refreshToken);
    expect(values).toContain(
      createHash("sha256").update(pair.accessToken).digest("hex"),
    );
  });

  it("resolves only a valid prefixed access token", async () => {
    const database = databaseReturning([{ user_id: "user-1" }]);
    const service = new SessionService(database);

    expect(await service.userIdForAccessToken("wrong")).toBeNull();
    expect(database.query).not.toHaveBeenCalled();
    expect(
      await service.userIdForAccessToken(`cg_access_${"a".repeat(43)}`),
    ).toBe("user-1");
  });

  it("revokes a session family when a previous refresh token is replayed", async () => {
    const database = databaseReturning([], 0);
    const service = new SessionService(database, {
      randomToken: () => "fixed-random-value",
    });

    expect(await service.rotate(`cg_refresh_${"a".repeat(43)}`)).toBeNull();
    expect(database.query).toHaveBeenCalledTimes(2);
    expect(database.query.mock.calls[1]?.[0]).toContain("previous_refresh_token_hash");
    expect(database.query.mock.calls[1]?.[0]).toContain("revoked_at=now()");
  });
});

describe("bearerToken", () => {
  it("accepts one canonical bearer credential", () => {
    expect(bearerToken(`Bearer cg_access_${"a".repeat(43)}`)).toBe(
      `cg_access_${"a".repeat(43)}`,
    );
    expect(bearerToken("bearer token")).toBeNull();
    expect(bearerToken("Bearer one two")).toBeNull();
  });
});
