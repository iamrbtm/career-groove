import test from "node:test";
import assert from "node:assert/strict";
import type { PoolClient } from "pg";
import { loadTrackerContext } from "@/lib/tracker-studio";

test("loads tracker context without concurrent queries on one client", async () => {
  let inFlight = false;
  const client = {
    async query() {
      assert.equal(inFlight, false, "a PoolClient must not receive concurrent queries");
      inFlight = true;
      await new Promise((resolve) => setImmediate(resolve));
      inFlight = false;
      return { rowCount: 0, rows: [] };
    },
  } as unknown as PoolClient;

  const context = await loadTrackerContext(client, "user-id");
  assert.equal(context.profile.name, null);
  assert.deepEqual(context.skills, []);
});
