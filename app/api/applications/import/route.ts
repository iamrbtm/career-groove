import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((value) => value.trim());
}

function normalizeStatus(raw: string) {
  const value = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return ["saved","researching","ready_to_apply","applied","follow_up","interviewing","offer","rejected","withdrawn","archived"].includes(value)
    ? value
    : "saved";
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const payload = await request.json().catch(() => null) as { csv?: string } | null;
  const csv = payload?.csv?.trim();
  if (!csv) return Response.json({ error: "Paste CSV content to import." }, { status: 400 });

  const rawLines = csv.split(/\r?\n/);
  const lines: string[] = [];
  let buffer = "";
  for (const rawLine of rawLines) {
    const combined = buffer ? `${buffer}\n${rawLine}` : rawLine;
    const quoteCount = (combined.match(/"/g) || []).length;
    if (quoteCount % 2 === 1) {
      buffer = combined;
    } else {
      if (buffer) { lines.push(combined); buffer = ""; }
      else if (combined.trim()) lines.push(combined);
    }
  }
  if (buffer) lines.push(buffer);
  if (lines.length < 2) return Response.json({ error: "CSV needs a header row and at least one data row." }, { status: 400 });
  if (lines.length > 1001) return Response.json({ error: "CSV file exceeds the maximum of 1000 rows." }, { status: 400 });
  const header = parseCsvLine(lines[0]);
  const required = ["title", "company"];
  for (const column of required) {
    if (!header.includes(column)) {
      return Response.json({ error: `Missing required column: ${column}` }, { status: 400 });
    }
  }

  const preview = lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""]));
    const errors: string[] = [];
    if (!row.title) errors.push("Missing title");
    if (!row.company) errors.push("Missing company");
    return { rowIndex: rowIndex + 2, row, errors };
  });
  const invalidRows = preview.filter((item) => item.errors.length > 0);
  if (invalidRows.length) return Response.json({ preview, invalidRows }, { status: 400 });

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    let imported = 0;
    for (const item of preview) {
      const row = item.row as Record<string, string>;
      const insert = await client.query(
        `INSERT INTO applications(user_id,title,company,location,work_mode,salary_min,salary_max,salary_currency,source,source_url,status,description,notes,follow_up_due_at,applied_at,metadata)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
         RETURNING id`,
        [
          user,
          row.title,
          row.company,
          row.location || null,
          row.workMode || null,
          row.salaryMin ? (isNaN(Number(row.salaryMin)) ? null : Number(row.salaryMin)) : null,
          row.salaryMax ? (isNaN(Number(row.salaryMax)) ? null : Number(row.salaryMax)) : null,
          row.salaryCurrency || "USD",
          row.source || null,
          row.sourceUrl || null,
          normalizeStatus(row.status || ""),
          row.description || `${row.title} at ${row.company}`,
          row.notes || null,
          row.followUpDueAt && /^\d{4}-\d{2}-\d{2}/.test(row.followUpDueAt) ? row.followUpDueAt : null,
          row.appliedAt && /^\d{4}-\d{2}-\d{2}/.test(row.appliedAt) ? row.appliedAt : null,
          JSON.stringify({ importedAt: new Date().toISOString(), importSource: "csv" }),
        ],
      );
      await client.query(
        `INSERT INTO application_events(user_id,application_id,event_type,title,body,metadata)
         VALUES($1,$2,'created','Imported application',$3,$4::jsonb)`,
        [user, insert.rows[0].id, `${row.title} at ${row.company}`, JSON.stringify({ source: "csv" })],
      );
      imported += 1;
    }
    await client.query("COMMIT");
    return Response.json({ imported, preview });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("CSV import failed", error);
    return Response.json({ error: "The CSV could not be imported." }, { status: 500 });
  } finally {
    client.release();
  }
}
