import { Hono } from "hono";
import { z } from "zod";

import {
  contactCreateSchema,
  credentialCreateSchema,
  documentCreateSchema,
  residenceCreateSchema,
  settingsUpdateSchema,
  skillCreateSchema,
  skillUpdateSchema,
} from "@career-groove/shared";

import type { Database } from "../../db.js";
import type { AppVariables } from "../../http.js";
import { jsonError } from "../../http.js";
import { createAuthMiddleware } from "../../middleware/auth.js";
import type { SessionService } from "../auth/session-service.js";

const idSchema = z.string().uuid();

interface Dependencies {
  database: Database;
  sessions: SessionService;
}

function authenticatedRoutes({ sessions }: Dependencies) {
  const routes = new Hono<{ Variables: AppVariables }>();
  routes.use("*", createAuthMiddleware(sessions));
  return routes;
}

export function createContactRoutes(dependencies: Dependencies) {
  const { database } = dependencies;
  const routes = authenticatedRoutes(dependencies);

  routes.get("/", async (context) => {
    const result = await database.query(
      `SELECT id,job_id AS "jobId",name,company,role,email,phone,
        relationship_strength AS "relationshipStrength",notes,links,created_at AS "createdAt"
       FROM contacts WHERE user_id=$1 ORDER BY created_at DESC`,
      [context.get("userId")],
    );
    return context.json({ contacts: result.rows });
  });

  routes.post("/", async (context) => {
    const parsed = contactCreateSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError(
        context,
        400,
        "invalid_contact",
        "Invalid contact",
        parsed.error.flatten(),
      );
    }
    const input = parsed.data;
    const notes = input.note
      ? [{ at: new Date().toISOString(), text: input.note }]
      : [];
    const result = await database.query(
      `INSERT INTO contacts
        (user_id,job_id,name,company,role,email,phone,relationship_strength,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
       RETURNING id,job_id AS "jobId",name,company,role,email,phone,
        relationship_strength AS "relationshipStrength",notes,links,created_at AS "createdAt"`,
      [
        context.get("userId"),
        input.jobId,
        input.name,
        input.company,
        input.role,
        input.email,
        input.phone,
        input.relationshipStrength,
        JSON.stringify(notes),
      ],
    );
    return context.json({ contact: result.rows[0] }, 201);
  });

  routes.delete("/:id", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    if (!id.success) {
      return jsonError(context, 400, "invalid_id", "Invalid contact id");
    }
    const result = await database.query(
      "DELETE FROM contacts WHERE id=$1 AND user_id=$2",
      [id.data, context.get("userId")],
    );
    if (!result.rowCount) {
      return jsonError(context, 404, "not_found", "Contact not found");
    }
    return context.body(null, 204);
  });

  return routes;
}

export function createResidenceRoutes(dependencies: Dependencies) {
  const { database } = dependencies;
  const routes = authenticatedRoutes(dependencies);

  routes.get("/", async (context) => {
    const result = await database.query(
      `SELECT id,label,address,started_on AS "startedOn",ended_on AS "endedOn",metadata
       FROM residences WHERE user_id=$1 ORDER BY started_on DESC NULLS LAST`,
      [context.get("userId")],
    );
    return context.json({ residences: result.rows });
  });

  routes.post("/", async (context) => {
    const parsed = residenceCreateSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError(
        context,
        400,
        "invalid_residence",
        "Invalid residence",
        parsed.error.flatten(),
      );
    }
    const input = parsed.data;
    const result = await database.query(
      `INSERT INTO residences(user_id,label,address,started_on,ended_on,metadata)
       VALUES($1,$2,$3::jsonb,$4,$5,$6::jsonb)
       RETURNING id,label,address,started_on AS "startedOn",ended_on AS "endedOn",metadata`,
      [
        context.get("userId"),
        input.label,
        JSON.stringify(input.address),
        input.startedOn,
        input.endedOn,
        JSON.stringify(input.metadata),
      ],
    );
    return context.json({ residence: result.rows[0] }, 201);
  });

  routes.put("/:id", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    const parsed = residenceCreateSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!id.success || !parsed.success) {
      return jsonError(context, 400, "invalid_residence", "Invalid residence");
    }
    const input = parsed.data;
    const result = await database.query(
      `UPDATE residences
       SET label=$3,address=$4::jsonb,started_on=$5,ended_on=$6,metadata=$7::jsonb
       WHERE id=$1 AND user_id=$2
       RETURNING id,label,address,started_on AS "startedOn",ended_on AS "endedOn",metadata`,
      [
        id.data,
        context.get("userId"),
        input.label,
        JSON.stringify(input.address),
        input.startedOn,
        input.endedOn,
        JSON.stringify(input.metadata),
      ],
    );
    if (!result.rows[0]) {
      return jsonError(context, 404, "not_found", "Residence not found");
    }
    return context.json({ residence: result.rows[0] });
  });

  routes.delete("/:id", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    if (!id.success) {
      return jsonError(context, 400, "invalid_id", "Invalid residence id");
    }
    const result = await database.query(
      "DELETE FROM residences WHERE id=$1 AND user_id=$2",
      [id.data, context.get("userId")],
    );
    if (!result.rowCount) {
      return jsonError(context, 404, "not_found", "Residence not found");
    }
    return context.body(null, 204);
  });

  return routes;
}

export function createCredentialRoutes(dependencies: Dependencies) {
  const { database } = dependencies;
  const routes = authenticatedRoutes(dependencies);

  routes.get("/", async (context) => {
    const result = await database.query(
      `SELECT id,kind,name,issuer,issued_on AS "issuedOn",
        expires_on AS "expiresOn",details
       FROM credentials WHERE user_id=$1 ORDER BY issued_on DESC NULLS LAST`,
      [context.get("userId")],
    );
    return context.json({ credentials: result.rows });
  });

  routes.post("/", async (context) => {
    const parsed = credentialCreateSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError(context, 400, "invalid_credential", "Invalid credential");
    }
    const input = parsed.data;
    const result = await database.query(
      `INSERT INTO credentials(user_id,kind,name,issuer,issued_on,expires_on,details)
       VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)
       RETURNING id,kind,name,issuer,issued_on AS "issuedOn",
        expires_on AS "expiresOn",details`,
      [
        context.get("userId"),
        input.kind,
        input.name,
        input.issuer,
        input.issuedOn,
        input.expiresOn,
        JSON.stringify(input.details),
      ],
    );
    return context.json({ credential: result.rows[0] }, 201);
  });

  routes.delete("/:id", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    if (!id.success) {
      return jsonError(context, 400, "invalid_id", "Invalid credential id");
    }
    const result = await database.query(
      "DELETE FROM credentials WHERE id=$1 AND user_id=$2",
      [id.data, context.get("userId")],
    );
    if (!result.rowCount) {
      return jsonError(context, 404, "not_found", "Credential not found");
    }
    return context.body(null, 204);
  });

  return routes;
}

export function createSkillRoutes(dependencies: Dependencies) {
  const { database } = dependencies;
  const routes = authenticatedRoutes(dependencies);

  routes.get("/", async (context) => {
    const result = await database.query(
      `SELECT id,name,proficiency,category,created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM skills WHERE user_id=$1 ORDER BY lower(name)`,
      [context.get("userId")],
    );
    return context.json({ skills: result.rows });
  });

  routes.post("/", async (context) => {
    const parsed = skillCreateSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError(context, 400, "invalid_skill", "Invalid skill");
    }
    const input = parsed.data;
    try {
      const result = await database.query(
        `INSERT INTO skills(user_id,name,proficiency,category)
         VALUES($1,$2,$3,$4)
         RETURNING id,name,proficiency,category,created_at AS "createdAt",
          updated_at AS "updatedAt"`,
        [
          context.get("userId"),
          input.name,
          input.proficiency,
          input.category,
        ],
      );
      return context.json({ skill: result.rows[0] }, 201);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        return jsonError(context, 409, "conflict", "Skill already exists");
      }
      throw error;
    }
  });

  routes.patch("/:id", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    const parsed = skillUpdateSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!id.success || !parsed.success || Object.keys(parsed.data).length === 0) {
      return jsonError(context, 400, "invalid_skill", "Invalid skill update");
    }
    const input = parsed.data;
    const result = await database.query(
      `UPDATE skills SET
        name=COALESCE($3,name),proficiency=COALESCE($4,proficiency),
        category=COALESCE($5,category),updated_at=now()
       WHERE id=$1 AND user_id=$2
       RETURNING id,name,proficiency,category,created_at AS "createdAt",
        updated_at AS "updatedAt"`,
      [
        id.data,
        context.get("userId"),
        input.name ?? null,
        input.proficiency ?? null,
        input.category ?? null,
      ],
    );
    if (!result.rows[0]) {
      return jsonError(context, 404, "not_found", "Skill not found");
    }
    return context.json({ skill: result.rows[0] });
  });

  routes.delete("/:id", async (context) => {
    const id = idSchema.safeParse(context.req.param("id"));
    if (!id.success) {
      return jsonError(context, 400, "invalid_id", "Invalid skill id");
    }
    const result = await database.query(
      "DELETE FROM skills WHERE id=$1 AND user_id=$2",
      [id.data, context.get("userId")],
    );
    if (!result.rowCount) {
      return jsonError(context, 404, "not_found", "Skill not found");
    }
    return context.body(null, 204);
  });

  return routes;
}

export function createDocumentRoutes(dependencies: Dependencies) {
  const { database } = dependencies;
  const routes = authenticatedRoutes(dependencies);
  routes.get("/", async (context) => {
    const result = await database.query(
      `SELECT id,kind,title,content,target_job AS "targetJob",created_at AS "createdAt"
       FROM documents WHERE user_id=$1 ORDER BY created_at DESC`,
      [context.get("userId")],
    );
    return context.json({ documents: result.rows });
  });
  routes.post("/", async (context) => {
    const parsed = documentCreateSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError(context, 400, "invalid_document", "Invalid document");
    }
    const input = parsed.data;
    const result = await database.query(
      `INSERT INTO documents(user_id,kind,title,content,target_job)
       VALUES($1,$2,$3,$4::jsonb,$5::jsonb)
       RETURNING id,kind,title,content,target_job AS "targetJob",created_at AS "createdAt"`,
      [
        context.get("userId"),
        input.kind,
        input.title,
        JSON.stringify({ text: input.text }),
        JSON.stringify(input.targetJob),
      ],
    );
    return context.json({ document: result.rows[0] }, 201);
  });
  return routes;
}

export function createSettingsRoutes(dependencies: Dependencies) {
  const { database } = dependencies;
  const routes = authenticatedRoutes(dependencies);
  routes.get("/", async (context) => {
    const result = await database.query(
      "SELECT preferences FROM users WHERE id=$1",
      [context.get("userId")],
    );
    return context.json({ settings: result.rows[0]?.preferences ?? {} });
  });
  routes.patch("/", async (context) => {
    const parsed = settingsUpdateSchema.safeParse(
      await context.req.json().catch(() => null),
    );
    if (!parsed.success) {
      return jsonError(context, 400, "invalid_settings", "Invalid settings");
    }
    const result = await database.query(
      `UPDATE users SET preferences=preferences || $1::jsonb,updated_at=now()
       WHERE id=$2 RETURNING preferences`,
      [JSON.stringify(parsed.data), context.get("userId")],
    );
    return context.json({ settings: result.rows[0]?.preferences ?? parsed.data });
  });
  return routes;
}
