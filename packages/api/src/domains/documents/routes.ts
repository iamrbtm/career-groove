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

const idSchema = z.string().uuid();
const jobInput = z
  .object({
    kind: z.enum(["resume", "cover_letter", "both"]),
    applicationId: z.string().uuid().optional(),
    target: z
      .object({
        title: z.string().trim().min(1).max(200),
        company: z.string().trim().min(1).max(200),
        description: z.string().trim().min(1).max(50_000),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((value) => Boolean(value.applicationId || value.target), {
    message: "Provide either applicationId or target",
  });

export function createDocumentJobRoutes({
  database,
  sessions,
}: Dependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.use("*", createAuthMiddleware(sessions));

  routes.get("/", async (context) => {
    const result = await database.query(
      `SELECT id,kind,target_job AS "targetJob",status,result,error,
        created_at AS "createdAt",started_at AS "startedAt",
        completed_at AS "completedAt",archived_at AS "archivedAt"
       FROM document_generation_jobs
       WHERE user_id=$1 AND archived_at IS NULL
       ORDER BY created_at DESC LIMIT 30`,
      [context.get("userId")],
    );
    return context.json({ jobs: result.rows });
  });

  routes.post("/", async (context) => {
    const parsed = jobInput.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError(
        context,
        400,
        "invalid_document_job",
        "Invalid document job",
        parsed.error.flatten(),
      );
    }
    const userId = context.get("userId");
    let targetJob: Record<string, unknown> | undefined = parsed.data.target;
    if (parsed.data.applicationId) {
      const target = await database.query<{
        company: string;
        description: string;
        id: string;
        metadata: Record<string, unknown>;
        title: string;
      }>(
        `SELECT id,title,company,description,metadata FROM applications
         WHERE id=$1 AND user_id=$2`,
        [parsed.data.applicationId, userId],
      );
      if (!target.rows[0]) {
        return jsonError(context, 404, "not_found", "Application not found");
      }
      targetJob = {
        applicationId: target.rows[0].id,
        company: target.rows[0].company,
        description: target.rows[0].description,
        research: target.rows[0].metadata?.research ?? null,
        title: target.rows[0].title,
      };
    }
    if (!targetJob) {
      return jsonError(context, 400, "missing_target", "Missing target role");
    }

    const [profile, history, credentials, residence, skills] =
      await Promise.all([
        database.query("SELECT name,email FROM users WHERE id=$1", [userId]),
        database.query(
          `SELECT company,title,location,started_on AS "startedOn",
            ended_on AS "endedOn",current,raw_notes AS "rawNotes",
            achievements,metadata FROM jobs WHERE user_id=$1
           ORDER BY current DESC,ended_on DESC NULLS LAST,
            started_on DESC NULLS LAST`,
          [userId],
        ),
        database.query(
          `SELECT kind,name,issuer,issued_on AS "issuedOn",
            expires_on AS "expiresOn",details FROM credentials
           WHERE user_id=$1 AND kind IN ('education','certification')
           ORDER BY issued_on DESC NULLS LAST,name`,
          [userId],
        ),
        database.query(
          `SELECT label,address,started_on AS "startedOn",
            ended_on AS "endedOn" FROM residences WHERE user_id=$1
           ORDER BY ended_on IS NULL DESC,started_on DESC NULLS LAST LIMIT 1`,
          [userId],
        ),
        database.query(
          `SELECT name,category,proficiency FROM skills WHERE user_id=$1
           ORDER BY proficiency DESC,name`,
          [userId],
        ),
      ]);
    const careerContext = {
      candidate: profile.rows[0] ?? {},
      certifications: credentials.rows.filter(
        (item) => item.kind === "certification",
      ),
      currentResidence: residence.rows[0] ?? null,
      education: credentials.rows.filter((item) => item.kind === "education"),
      jobs: history.rows,
      skills: skills.rows,
    };
    const created = await database.query(
      `INSERT INTO document_generation_jobs
        (user_id,kind,target_job,career_context)
       VALUES($1,$2,$3::jsonb,$4::jsonb)
       RETURNING id,kind,target_job AS "targetJob",status,result,error,
        created_at AS "createdAt"`,
      [
        userId,
        parsed.data.kind,
        JSON.stringify(targetJob),
        JSON.stringify(careerContext),
      ],
    );
    return context.json({ job: created.rows[0] }, 202);
  });

  routes.patch("/:id", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    const input = z
      .object({ archived: z.literal(true) })
      .strict()
      .safeParse(await context.req.json().catch(() => null));
    if (!id.success || !input.success) {
      return jsonError(context, 400, "invalid_document_job", "Invalid document job");
    }
    const result = await database.query(
      `WITH archived AS (
         UPDATE document_generation_jobs SET archived_at=now(),updated_at=now()
         WHERE id=$1 AND user_id=$2 AND archived_at IS NULL RETURNING id
       ), links AS (
         UPDATE application_documents SET status='archived',updated_at=now()
         WHERE document_generation_job_id=$1 AND user_id=$2
          AND status<>'archived' AND EXISTS (SELECT 1 FROM archived)
       )
       SELECT id FROM archived`,
      [id.data, context.get("userId")],
    );
    if (!result.rows[0]) {
      return jsonError(context, 404, "not_found", "Draft not found");
    }
    return context.json({ ok: true });
  });

  routes.post("/:id/reprocess", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    if (!id.success) {
      return jsonError(context, 400, "invalid_document_job", "Invalid document job");
    }
    const result = await database.query(
      `INSERT INTO document_generation_jobs
        (user_id,kind,target_job,career_context)
       SELECT user_id,kind,target_job,career_context
       FROM document_generation_jobs WHERE id=$1 AND user_id=$2
       RETURNING id,kind,target_job AS "targetJob",status,result,error,
        created_at AS "createdAt",archived_at AS "archivedAt"`,
      [id.data, context.get("userId")],
    );
    if (!result.rows[0]) {
      return jsonError(context, 404, "not_found", "Draft not found");
    }
    return context.json({ job: result.rows[0] }, 202);
  });

  return routes;
}
