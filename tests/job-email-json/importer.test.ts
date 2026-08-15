import test from "node:test";
import assert from "node:assert/strict";
import { classifyJobEmailEntries, importJobEmailEntries } from "@/lib/job-email-json/importer";
import { extractJobJson } from "@/lib/job-email-json/extractor";
import { parseJobEmailPayload } from "@/lib/job-email-json/schema";
import { validEmailBody } from "./fixtures";

function asResolved(job: ReturnType<typeof parseJobEmailPayload>["jobs"][number]) {
  return { job, description: "test description", descriptionSource: "humanized" as const };
}

test("continues importing entries after one entry fails", async () => {
  const payload = parseJobEmailPayload(extractJobJson(validEmailBody));
  const entries = [
    asResolved(payload.jobs[0]),
    asResolved({ ...payload.jobs[0], job_id: "second-job", dedupe_key: "a".repeat(64) }),
  ];
  let insertCount = 0;
  const client = {
    async query(sql: string) {
      if (sql.includes("SELECT id FROM applications")) return { rowCount: 0, rows: [] };
      insertCount += 1;
      if (insertCount === 1) throw new Error("insert failed");
      return { rowCount: 1, rows: [{ id: "created-application" }] };
    },
  } as unknown as Parameters<typeof importJobEmailEntries>[0];

  const result = await importJobEmailEntries(client, "user-id", entries, {
    searchRunDate: payload.search_run_date,
  });

  assert.equal(result.jobsReceived, 2);
  assert.equal(result.jobsCreated, 1);
  assert.equal(result.jobsFailed, 1);
  assert.deepEqual(result.jobs.map((job) => job.status), ["failed", "created"]);
});

test("classifies in-request duplicate fallback keys before import", async () => {
  const payload = parseJobEmailPayload(extractJobJson(validEmailBody));
  const [job] = payload.jobs;
  const entries = [
    asResolved({ ...job, dedupe_key: "a".repeat(64), canonical_url: null }),
    asResolved({ ...job, dedupe_key: "b".repeat(64), canonical_url: null }),
  ];
  const client = {
    async query() {
      return { rowCount: 0, rows: [] };
    },
  };

  const result = await classifyJobEmailEntries(client, "user-id", entries);

  assert.deepEqual(result, [
    { jobId: entries[0].job.job_id, status: "new" },
    { jobId: entries[1].job.job_id, status: "duplicate" },
  ]);
});
