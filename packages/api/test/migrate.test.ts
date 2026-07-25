import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { Database } from "../src/db.js";
import { migrateDatabase } from "../src/migrate.js";

describe("database migration", () => {
  it("serializes schema and sorted migrations with an advisory lock", async () => {
    const root = await mkdtemp(join(tmpdir(), "career-groove-migrate-"));
    await mkdir(join(root, "db/migrations"), { recursive: true });
    await writeFile(join(root, "db/schema.sql"), "SELECT 'schema'");
    await writeFile(join(root, "db/migrations/010_second.sql"), "SELECT 2");
    await writeFile(join(root, "db/migrations/002_first.sql"), "SELECT 1");
    const query = vi.fn().mockResolvedValue({ rows: [] });

    await expect(
      migrateDatabase({ query } as unknown as Database, root),
    ).resolves.toBe(2);
    expect(query).toHaveBeenCalledOnce();
    const sql = query.mock.calls[0]?.[0] as string;
    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql.indexOf("SELECT 'schema'")).toBeLessThan(sql.indexOf("SELECT 1"));
    expect(sql.indexOf("SELECT 1")).toBeLessThan(sql.indexOf("SELECT 2"));
    expect(sql.trimEnd().endsWith("COMMIT;")).toBe(true);
  });
});
