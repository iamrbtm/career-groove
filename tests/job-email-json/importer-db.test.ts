import test from "node:test";
import assert from "node:assert/strict";
import { classifyJobEmailEntries, importJobEmailEntries } from "@/lib/job-email-json/importer";
import { makeDbClient, seedUser, validPayload } from "./importer-db.test-helpers";

test("second import skips duplicates by dedupe_key", async () => {
  const client = await makeDbClient();
  try {
    const userId = await seedUser(client);
    const first = await importJobEmailEntries(client, userId, validPayload.jobs, { searchRunDate: validPayload.search_run_date });
    const second = await importJobEmailEntries(client, userId, validPayload.jobs, { searchRunDate: validPayload.search_run_date });
    assert.equal(first.jobsCreated, 1);
    assert.equal(second.jobsCreated, 0);
    assert.equal(second.duplicatesSkipped, 1);
  } finally {
    await client.end();
  }
});

test("skips duplicates by source_job_id for the same company", async () => {
  const client = await makeDbClient();
  try {
    const userId = await seedUser(client);
    const [job] = validPayload.jobs;
    const first = { ...job, canonical_url: null, dedupe_key: "a".repeat(64) };
    const second = { ...first, dedupe_key: "b".repeat(64) };
    await importJobEmailEntries(client, userId, [first], { searchRunDate: validPayload.search_run_date });
    const result = await importJobEmailEntries(client, userId, [second], { searchRunDate: validPayload.search_run_date });
    assert.equal(result.duplicatesSkipped, 1);
  } finally {
    await client.end();
  }
});

test("classifies existing duplicates before quota checks", async () => {
  const client = await makeDbClient();
  try {
    const userId = await seedUser(client);
    const [job] = validPayload.jobs;
    await importJobEmailEntries(client, userId, [job], { searchRunDate: validPayload.search_run_date });
    const result = await classifyJobEmailEntries(client, userId, [
      job,
      {
        ...job,
        job_id: "fresh-job",
        dedupe_key: "f".repeat(64),
        source_job_id: "fresh-source-job-id",
        canonical_url: "https://example.com/fresh-job",
      },
    ]);
    assert.deepEqual(result.map((entry) => entry.status), ["duplicate", "new"]);
  } finally {
    await client.end();
  }
});

test("skips duplicates by canonical_url", async () => {
  const client = await makeDbClient();
  try {
    const userId = await seedUser(client);
    const [job] = validPayload.jobs;
    const first = { ...job, source_job_id: null, dedupe_key: "c".repeat(64) };
    const second = { ...first, company: "Another Company", dedupe_key: "d".repeat(64) };
    await importJobEmailEntries(client, userId, [first], { searchRunDate: validPayload.search_run_date });
    const result = await importJobEmailEntries(client, userId, [second], { searchRunDate: validPayload.search_run_date });
    assert.equal(result.duplicatesSkipped, 1);
  } finally {
    await client.end();
  }
});

test("stores JSON-derived salary and import metadata", async () => {
  const client = await makeDbClient();
  try {
    const userId = await seedUser(client);
    await importJobEmailEntries(client, userId, validPayload.jobs, { searchRunDate: validPayload.search_run_date });
    const result = await client.query<{
      work_mode: string;
      salary_min: number;
      salary_max: number;
      salary_period: string;
      salary_raw: string;
      source: string;
      search_run_date: Date;
    }>(`SELECT work_mode,salary_min,salary_max,salary_period,salary_raw,source,search_run_date FROM applications WHERE user_id=$1`, [userId]);
    assert.deepEqual({
      ...result.rows[0],
      search_run_date: result.rows[0].search_run_date.toISOString().slice(0, 10),
    }, {
      work_mode: "remote",
      salary_min: 53550,
      salary_max: 89775,
      salary_period: "year",
      salary_raw: "$53,550-$89,775 depending on U.S. location tier",
      source: "email_json_import",
      search_run_date: "2026-08-09",
    });
  } finally {
    await client.end();
  }
});

test("records the creation event and latest tracker score", async () => {
  const client = await makeDbClient();
  try {
    const userId = await seedUser(client);
    const result = await importJobEmailEntries(client, userId, validPayload.jobs, { searchRunDate: validPayload.search_run_date });
    assert.equal(result.jobs[0].status, "created");
    assert.ok(result.jobs[0].latestScore);

    const events = await client.query<{ event_type: string; title: string }>(
      "SELECT event_type,title FROM application_events WHERE user_id=$1",
      [userId],
    );
    const scores = await client.query<{ count: string }>(
      "SELECT COUNT(*) FROM application_scores WHERE user_id=$1",
      [userId],
    );
    assert.deepEqual(events.rows, [{ event_type: "created", title: "Imported from email" }]);
    assert.equal(scores.rows[0].count, "1");
  } finally {
    await client.end();
  }
});

test("concurrent imports with a shared fallback key create one application", async () => {
  const firstClient = await makeDbClient();
  const secondClient = await makeDbClient();
  try {
    const userId = await seedUser(firstClient);
    const [job] = validPayload.jobs;
    const first = { ...job, dedupe_key: "e".repeat(64) };
    const second = { ...job, dedupe_key: "f".repeat(64) };
    const [firstResult, secondResult] = await Promise.all([
      importJobEmailEntries(firstClient, userId, [first], { searchRunDate: validPayload.search_run_date }),
      importJobEmailEntries(secondClient, userId, [second], { searchRunDate: validPayload.search_run_date }),
    ]);
    const result = await firstClient.query<{ count: string }>(
      "SELECT COUNT(*) FROM applications WHERE user_id=$1",
      [userId],
    );
    assert.equal(Number(firstResult.jobsCreated + secondResult.jobsCreated), 1);
    assert.equal(result.rows[0].count, "1");
  } finally {
    await firstClient.end();
    await secondClient.end();
  }
});
