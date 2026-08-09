import test from "node:test";
import assert from "node:assert/strict";
import { importJobEmailEntries } from "@/lib/job-email-json/importer";
import { extractJobJson } from "@/lib/job-email-json/extractor";
import { parseJobEmailPayload } from "@/lib/job-email-json/schema";
import { validEmailBody } from "./fixtures";

test("continues importing entries after one entry fails", async () => {
  const payload = parseJobEmailPayload(extractJobJson(validEmailBody));
  const entries = [
    payload.jobs[0],
    { ...payload.jobs[0], job_id: "second-job", dedupe_key: "a".repeat(64) },
  ];
  let insertCount = 0;
  const client = {
    async query(sql: string) {
      if (sql.includes("SELECT id FROM applications")) return { rowCount: 0, rows: [] };
      insertCount += 1;
      if (insertCount === 1) throw new Error("insert failed");
      return { rowCount: 1, rows: [{ id: "created-application" }] };
    },
  };

  const result = await importJobEmailEntries(client, "user-id", entries, {
    searchRunDate: payload.search_run_date,
  });

  assert.equal(result.jobsReceived, 2);
  assert.equal(result.jobsCreated, 1);
  assert.equal(result.jobsFailed, 1);
  assert.deepEqual(result.jobs.map((job) => job.status), ["failed", "created"]);
});
