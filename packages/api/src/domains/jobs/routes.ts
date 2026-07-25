import { Hono } from "hono";
import { z } from "zod";

import {
  createJobSchema,
  databaseJobSchema,
  serializeJob,
  updateJobSchema,
} from "@career-groove/shared";

import type { Database } from "../../db.js";
import type { AppVariables } from "../../http.js";
import { jsonError } from "../../http.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import type { SessionService } from "../auth/session-service.js";

const idSchema = z.string().uuid();

interface JobRouteDependencies {
  database: Database;
  sessions: SessionService;
}

const updateColumns = {
  achievements: "achievements",
  company: "company",
  current: "current",
  endedOn: "ended_on",
  location: "location",
  metadata: "metadata",
  rawNotes: "raw_notes",
  startedOn: "started_on",
  title: "title",
} as const;

export function createJobRoutes({
  database,
  sessions,
}: JobRouteDependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.use("*", createAuthMiddleware(sessions));

  routes.get("/", async (context) => {
    const result = await database.query(
      `SELECT * FROM jobs
       WHERE user_id=$1 ORDER BY started_on DESC NULLS LAST,created_at DESC`,
      [context.get("userId")],
    );
    return context.json({
      jobs: result.rows.map((row) =>
        serializeJob(databaseJobSchema.parse(row)),
      ),
    });
  });

  routes.get("/:id", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    if (!id.success) {
      return jsonError(context, 400, "invalid_id", "Invalid job id");
    }
    const result = await database.query(
      "SELECT * FROM jobs WHERE id=$1 AND user_id=$2",
      [id.data, context.get("userId")],
    );
    const row = result.rows[0];
    if (!row) return jsonError(context, 404, "not_found", "Job not found");
    return context.json({
      job: serializeJob(databaseJobSchema.parse(row)),
    });
  });

  routes.post("/", async (context) => {
    const parsed = createJobSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError(
        context,
        400,
        "invalid_job",
        "Invalid job",
        parsed.error.flatten(),
      );
    }
    const input = parsed.data;
    const result = await database.query(
      `INSERT INTO jobs
        (user_id,company,title,location,started_on,ended_on,current,raw_notes,
         achievements,metadata)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb)
       RETURNING *`,
      [
        context.get("userId"),
        input.company,
        input.title,
        input.location,
        input.startedOn,
        input.endedOn,
        input.current,
        input.rawNotes,
        JSON.stringify(input.achievements),
        JSON.stringify(input.metadata),
      ],
    );
    return context.json(
      {
        job: serializeJob(databaseJobSchema.parse(result.rows[0])),
      },
      201,
    );
  });

  routes.patch("/:id", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    const parsed = updateJobSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!id.success || !parsed.success || Object.keys(parsed.data).length === 0) {
      return jsonError(context, 400, "invalid_job", "Invalid job update");
    }

    const values: unknown[] = [id.data, context.get("userId")];
    const assignments = Object.entries(parsed.data).map(([key, value]) => {
      const column = updateColumns[key as keyof typeof updateColumns];
      values.push(
        key === "achievements" || key === "metadata"
          ? JSON.stringify(value)
          : value,
      );
      const cast = key === "achievements" || key === "metadata" ? "::jsonb" : "";
      return `${column}=$${values.length}${cast}`;
    });
    const result = await database.query(
      `UPDATE jobs SET ${assignments.join(",")},updated_at=now()
       WHERE id=$1 AND user_id=$2 RETURNING *`,
      values,
    );
    const row = result.rows[0];
    if (!row) return jsonError(context, 404, "not_found", "Job not found");
    return context.json({
      job: serializeJob(databaseJobSchema.parse(row)),
    });
  });

  routes.delete("/:id", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    if (!id.success) {
      return jsonError(context, 400, "invalid_id", "Invalid job id");
    }
    const result = await database.query(
      "DELETE FROM jobs WHERE id=$1 AND user_id=$2",
      [id.data, context.get("userId")],
    );
    if (!result.rowCount) {
      return jsonError(context, 404, "not_found", "Job not found");
    }
    return context.body(null, 204);
  });

  return routes;
}
