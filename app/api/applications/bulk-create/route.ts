import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized, getUserTier } from "@/lib/api-auth";
import { applicationCreateSchema } from "@/lib/application-schema";
import { parseJobPost } from "@/lib/job-post-parser";
import { refreshApplicationScore } from "@/lib/tracker-studio";
import { autoResearchApplication } from "@/lib/auto-research";

const inputSchema = z.object({
  entries: z.array(applicationCreateSchema).min(1).max(50),
});

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const entries = parsed.data.entries;
  const tier = await getUserTier(user);
  if (tier === "free") {
    const countResult = await db.query(
      `SELECT COUNT(*) FROM applications WHERE user_id=$1 AND archived_at IS NULL AND status <> 'archived'`,
      [user],
    );
    const activeCount = parseInt(countResult.rows[0]?.count || "0", 10);
    if (activeCount + entries.length > 5) {
      return Response.json(
        { error: `Free plan is limited to 5 active roles. You have ${activeCount} active and tried to add ${entries.length}. Upgrade to Pro for unlimited tracking.` },
        { status: 403 },
      );
    }
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const created: Array<{ id: string; title: string; company: string; latestScore: unknown }> = [];

    for (const input of entries) {
      const parsedJob = parseJobPost({
        text: input.description,
        sourceUrl: input.sourceUrl || undefined,
        fallbackTitle: input.title,
        fallbackCompany: input.company,
      });
      const inserted = await client.query(
        `INSERT INTO applications(user_id,title,company,location,work_mode,salary_min,salary_max,salary_currency,source_url,source,description,notes,metadata)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
         RETURNING id,status,title,company,location,work_mode AS "workMode",
          salary_min AS "salaryMin",salary_max AS "salaryMax",salary_currency AS "salaryCurrency",
          source_url AS "sourceUrl",source,description,notes,priority_label AS "priorityLabel",
          next_action_type AS "nextActionType",next_action_reason AS "nextActionReason",
          follow_up_due_at AS "followUpDueAt",applied_at AS "appliedAt",archived_at AS "archivedAt",
          metadata,created_at AS "createdAt",updated_at AS "updatedAt"`,
        [
          user,
          input.title,
          input.company,
          input.location || null,
          input.workMode || null,
          input.salaryMin || null,
          input.salaryMax || null,
          input.salaryCurrency,
          input.sourceUrl || null,
          input.source || null,
          input.description,
          input.notes || null,
          JSON.stringify({ ...input.metadata, parsedJob, importSource: "email", importedAt: new Date().toISOString() }),
        ],
      );
      await client.query(
        `INSERT INTO application_events(user_id,application_id,event_type,title,body,metadata)
         VALUES($1,$2,'created','Imported from email',$3,$4::jsonb)`,
        [user, inserted.rows[0].id, `${input.title} at ${input.company}`, JSON.stringify({ source: "email" })],
      );
      const score = await refreshApplicationScore(client, user, inserted.rows[0].id);
      created.push({
        id: inserted.rows[0].id,
        title: input.title,
        company: input.company,
        latestScore: score?.latestScore ?? null,
      });
    }

    await client.query("COMMIT");

    for (const app of created) {
      const entry = entries.find((e) => e.title === app.title && e.company === app.company);
      if (entry) {
        autoResearchApplication(
          app.id,
          user,
          entry.sourceUrl || null,
          entry.company,
          entry.description,
        );
      }
    }

    return Response.json({ created, failed: [] }, { status: 201 });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Bulk create failed", error);
    return Response.json({ error: "The applications could not be created. No changes were made." }, { status: 500 });
  } finally {
    client.release();
  }
}
