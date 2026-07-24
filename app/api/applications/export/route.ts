import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  const result = await db.query(
    `SELECT title,company,location,work_mode AS "workMode",salary_min AS "salaryMin",salary_max AS "salaryMax",
      salary_currency AS "salaryCurrency",source,source_url AS "sourceUrl",status,priority_label AS "priorityLabel",
      next_action_reason AS "nextActionReason",follow_up_due_at AS "followUpDueAt",applied_at AS "appliedAt",
      created_at AS "createdAt",notes
     FROM applications
     WHERE user_id=$1
     ORDER BY created_at DESC`,
    [user],
  );
  const header = [
    "title","company","location","workMode","salaryMin","salaryMax","salaryCurrency","source","sourceUrl","status","priorityLabel","nextActionReason","followUpDueAt","appliedAt","createdAt","notes",
  ];
  const lines = [header.join(",")];
  for (const row of result.rows) {
    lines.push(header.map((key) => escapeCsv(row[key])).join(","));
  }
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="career-groove-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
