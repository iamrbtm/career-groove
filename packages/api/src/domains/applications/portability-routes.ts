import { Hono } from "hono";
import { z } from "zod";

import type { Database } from "../../db.js";
import type { AppVariables } from "../../http.js";
import { jsonError } from "../../http.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import type { SessionService } from "../auth/session-service.js";

interface Dependencies {
  database: Database;
  sessions: SessionService;
}

const columns = [
  "title",
  "company",
  "location",
  "workMode",
  "salaryMin",
  "salaryMax",
  "salaryCurrency",
  "source",
  "sourceUrl",
  "status",
  "priorityLabel",
  "nextActionReason",
  "followUpDueAt",
  "appliedAt",
  "createdAt",
  "notes",
] as const;
const statuses = new Set([
  "saved",
  "researching",
  "ready_to_apply",
  "applied",
  "follow_up",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
  "archived",
]);

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsv(value: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (character === '"') {
      if (quoted && value[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && value[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function optionalNumber(value: string): number | null {
  if (!value) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error("Invalid salary");
  return Math.round(number);
}

export function createApplicationPortabilityRoutes({
  database,
  sessions,
}: Dependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.use("*", createAuthMiddleware(sessions));

  routes.get("/export", async (context) => {
    const result = await database.query<Record<string, unknown>>(
      `SELECT title,company,location,work_mode AS "workMode",
        salary_min AS "salaryMin",salary_max AS "salaryMax",
        salary_currency AS "salaryCurrency",source,source_url AS "sourceUrl",
        status,priority_label AS "priorityLabel",
        next_action_reason AS "nextActionReason",
        follow_up_due_at AS "followUpDueAt",applied_at AS "appliedAt",
        created_at AS "createdAt",notes
       FROM applications WHERE user_id=$1 ORDER BY created_at DESC`,
      [context.get("userId")],
    );
    const lines = [
      columns.join(","),
      ...result.rows.map((row) =>
        columns.map((column) => csvCell(row[column])).join(","),
      ),
    ];
    context.header("Content-Type", "text/csv; charset=utf-8");
    context.header(
      "Content-Disposition",
      `attachment; filename="career-groove-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    context.header("Cache-Control", "private, no-store");
    return context.body(lines.join("\n"));
  });

  routes.post("/import", async (context) => {
    const input = z
      .object({ csv: z.string().trim().min(1).max(650_000) })
      .strict()
      .safeParse(await context.req.json().catch(() => null));
    if (!input.success) {
      return jsonError(context, 400, "invalid_csv", "Paste valid CSV content to import");
    }
    let parsedRows: string[][];
    try {
      parsedRows = parseCsv(input.data.csv);
    } catch {
      return jsonError(context, 400, "invalid_csv", "CSV contains an invalid quoted field");
    }
    if (parsedRows.length < 2 || parsedRows.length > 501) {
      return jsonError(
        context,
        400,
        "invalid_csv_size",
        "CSV must contain a header and between 1 and 500 data rows",
      );
    }
    const [header, ...dataRows] = parsedRows;
    if (
      !header ||
      new Set(header).size !== header.length ||
      !header.includes("title") ||
      !header.includes("company")
    ) {
      return jsonError(
        context,
        400,
        "invalid_csv_header",
        "CSV requires unique title and company columns",
      );
    }
    try {
      const rows = dataRows.map((values, rowIndex) => {
        const row = Object.fromEntries(
          header.map((column, index) => [column, values[index] ?? ""]),
        );
        if (!row.title || !row.company) {
          throw new Error(`Missing title or company on row ${rowIndex + 2}`);
        }
        const status = (row.status || "saved")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_");
        return {
          appliedAt: row.appliedAt || null,
          company: row.company.slice(0, 200),
          description:
            row.description?.slice(0, 50_000) ||
            `${row.title} at ${row.company}`,
          followUpDueAt: row.followUpDueAt || null,
          location: row.location?.slice(0, 200) || null,
          notes: row.notes?.slice(0, 5_000) || null,
          salaryCurrency: row.salaryCurrency?.slice(0, 3).toUpperCase() || "USD",
          salaryMax: optionalNumber(row.salaryMax ?? ""),
          salaryMin: optionalNumber(row.salaryMin ?? ""),
          source: row.source?.slice(0, 200) || null,
          sourceUrl: row.sourceUrl || null,
          status: statuses.has(status) ? status : "saved",
          title: row.title.slice(0, 200),
          workMode: row.workMode?.slice(0, 80) || null,
        };
      });
      const result = await database.query(
        `WITH payload AS (
           SELECT * FROM jsonb_to_recordset($2::jsonb) AS row(
            title text,company text,location text,"workMode" text,
            "salaryMin" integer,"salaryMax" integer,"salaryCurrency" text,
            source text,"sourceUrl" text,status text,description text,notes text,
            "followUpDueAt" timestamptz,"appliedAt" timestamptz
           )
         ), inserted AS (
           INSERT INTO applications
            (user_id,title,company,location,work_mode,salary_min,salary_max,
             salary_currency,source,source_url,status,description,notes,
             follow_up_due_at,applied_at,metadata)
           SELECT $1,title,company,location,"workMode","salaryMin","salaryMax",
            "salaryCurrency",source,"sourceUrl",status,description,notes,
            "followUpDueAt","appliedAt",
            jsonb_build_object('importedAt',now(),'importSource','csv')
           FROM payload RETURNING id,title,company
         ), events AS (
           INSERT INTO application_events
            (user_id,application_id,event_type,title,body,metadata)
           SELECT $1,id,'created','Imported application',title || ' at ' || company,
            jsonb_build_object('source','csv') FROM inserted
         )
         SELECT count(*)::int AS imported FROM inserted`,
        [context.get("userId"), JSON.stringify(rows)],
      );
      return context.json({ imported: result.rows[0]?.imported ?? rows.length });
    } catch (error) {
      return jsonError(
        context,
        400,
        "invalid_csv_row",
        error instanceof Error ? error.message : "CSV contains invalid data",
      );
    }
  });

  return routes;
}
