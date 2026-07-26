import { describe, expect, it, vi } from "vitest";

import { SessionClient, type TokenStore } from "./session-client";

const originalTokens = {
  accessToken: `cg_access_${"a".repeat(43)}`,
  refreshToken: `cg_refresh_${"b".repeat(43)}`,
  accessTokenExpiresAt: "2026-07-25T12:15:00.000Z",
  refreshTokenExpiresAt: "2026-08-24T12:00:00.000Z",
};
const rotatedTokens = {
  ...originalTokens,
  accessToken: `cg_access_${"c".repeat(43)}`,
  refreshToken: `cg_refresh_${"d".repeat(43)}`,
};

function memoryStore(): TokenStore & {
  clear: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
} {
  return {
    clear: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(originalTokens),
    save: vi.fn().mockResolvedValue(undefined),
  };
}

describe("SessionClient", () => {
  it("calls the default fetch transport with the browser global receiver", async () => {
    const browserFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) {
        throw new TypeError(
          "'fetch' called on an object that does not implement interface Window.",
        );
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal("fetch", browserFetch);

    try {
      const client = new SessionClient({
        baseUrl: "https://api.example",
        store: {
          clear: vi.fn().mockResolvedValue(undefined),
          load: vi.fn().mockResolvedValue(null),
          save: vi.fn().mockResolvedValue(undefined),
        },
      });

      await expect(client.request("/api/health")).resolves.toMatchObject({
        status: 204,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("adds the current access token to authenticated requests", async () => {
    const transport = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ jobs: [] }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
    const client = new SessionClient({
      baseUrl: "https://api.example",
      store: memoryStore(),
      transport,
    });

    await client.request("/api/jobs");

    expect(transport.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: `Bearer ${originalTokens.accessToken}`,
    });
  });

  it("uses one refresh request for concurrent unauthorized responses", async () => {
    let protectedCalls = 0;
    const transport = vi.fn(async (url: string | URL | Request) => {
      if (String(url).endsWith("/api/mobile/auth/refresh")) {
        return new Response(JSON.stringify(rotatedTokens), { status: 200 });
      }
      protectedCalls += 1;
      return protectedCalls <= 2
        ? new Response(null, { status: 401 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const store = memoryStore();
    const client = new SessionClient({
      baseUrl: "https://api.example",
      store,
      transport,
    });

    const responses = await Promise.all([
      client.request("/api/jobs"),
      client.request("/api/contacts"),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(
      transport.mock.calls.filter(([url]) =>
        String(url).endsWith("/api/mobile/auth/refresh"),
      ),
    ).toHaveLength(1);
    expect(store.save).toHaveBeenCalledWith(rotatedTokens);
  });

  it("clears credentials when refresh fails", async () => {
    const transport = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith("/api/mobile/auth/refresh")
        ? new Response(null, { status: 401 })
        : new Response(null, { status: 401 }),
    );
    const store = memoryStore();
    const client = new SessionClient({
      baseUrl: "https://api.example",
      store,
      transport,
    });

    await expect(client.request("/api/jobs")).rejects.toThrow(
      "Session expired",
    );
    expect(store.clear).toHaveBeenCalledOnce();
  });
});
