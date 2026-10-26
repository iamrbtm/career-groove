import test from "node:test";
import assert from "node:assert/strict";
import { apiFetch, getApiError } from "@/lib/ui/api-fetch";

function stubFetch(res: { ok: boolean; status: number; body: string }) {
  const response = {
    ok: res.ok,
    status: res.status,
    json: async () => JSON.parse(res.body),
  };
  globalThis.fetch = (async () => response) as unknown as typeof fetch;
}

test("apiFetch returns the response when res.ok is true", async () => {
  stubFetch({ ok: true, status: 200, body: JSON.stringify({ id: "abc" }) });
  const res = await apiFetch("/api/thing");
  assert.equal(res.ok, true);
  assert.deepEqual(await res.json(), { id: "abc" });
});

test("apiFetch throws with the server error string and attaches status", async () => {
  stubFetch({ ok: false, status: 422, body: JSON.stringify({ error: "Step already advanced." }) });
  const err = await apiFetch("/api/thing").then(
    () => null,
    (e) => e,
  );
  assert.ok(err instanceof Error);
  assert.match(err.message, /Step already advanced/);
  assert.equal((err as { status?: number }).status, 422);
});

test("apiFetch falls back to the server message field", async () => {
  stubFetch({ ok: false, status: 400, body: JSON.stringify({ message: "Invalid payload." }) });
  const err = await apiFetch("/api/thing").then(
    () => null,
    (e) => e,
  );
  assert.ok(err instanceof Error);
  assert.equal(err.message, "Invalid payload.");
  assert.equal((err as { status?: number }).status, 400);
});

test("apiFetch throws a status message when the body is not JSON", async () => {
  stubFetch({ ok: false, status: 500, body: "" });
  const err = await apiFetch("/api/thing").then(
    () => null,
    (e) => e,
  );
  assert.ok(err instanceof Error);
  assert.equal(err.message, "Request failed (500)");
  assert.equal((err as { status?: number }).status, 500);
});

test("getApiError returns Error messages verbatim", () => {
  assert.equal(getApiError(new Error("Network hiccup.")), "Network hiccup.");
});

test("getApiError returns plain strings verbatim", () => {
  assert.equal(getApiError("plain"), "plain");
});

test("getApiError falls back to a safe message for unknown throwables", () => {
  assert.equal(getApiError(undefined), "Something went wrong.");
  assert.equal(getApiError(null), "Something went wrong.");
  assert.equal(getApiError({ weird: true }), "Something went wrong.");
});
