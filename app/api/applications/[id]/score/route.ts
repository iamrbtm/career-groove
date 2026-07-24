import { z } from "zod";
import { generateText } from "ai";

import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { careerDjLabelSchema, commandSessionActionSchema } from "@/lib/application-schema";
import { getModel } from "@/lib/ai";
import { providerSchema } from "@/lib/provider-models";
import { decryptSecret } from "@/lib/secret-box";
import { buildTrackerReadiness, loadTrackerContext, refreshApplicationScore } from "@/lib/tracker-studio";

const idSchema = z.string().uuid();
const aiScoreSchema = z.object({
  fit: z.number().int().min(0).max(100),
  readiness: z.number().int().min(0).max(100),
  desire: z.number().int().min(0).max(100),
  leverage: z.number().int().min(0).max(100),
  risk: z.number().int().min(0).max(100),
  timing: z.number().int().min(0).max(100),
  label: careerDjLabelSchema,
  reasons: z.array(z.string().trim().min(1).max(240)).max(4),
  gaps: z.array(z.string().trim().min(1).max(240)).max(4),
  nextAction: commandSessionActionSchema,
  nextActionReason: z.string().trim().min(1).max(500),
});

function jsonFromText(text: string) {
  const trimmed = text.trim();
  const match = trimmed.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : trimmed);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: "Invalid application id" }, { status: 400 });
  const useAi = new URL(request.url).searchParams.get("ai") === "true";

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const score = await refreshApplicationScore(client, user, id.data);
    if (!score) {
      await client.query("ROLLBACK");
      return Response.json({ error: "Application not found" }, { status: 404 });
    }
    if (useAi) {
      const [application, preferences, connections] = await Promise.all([
        client.query(
          `SELECT id,status,title,company,location,work_mode AS "workMode",salary_min AS "salaryMin",salary_max AS "salaryMax",
            description,notes,source_url AS "sourceUrl",source,metadata
           FROM applications WHERE id=$1 AND user_id=$2`,
          [id.data, user],
        ),
        client.query("SELECT preferences FROM users WHERE id=$1", [user]),
        client.query(
          `SELECT provider,encrypted_api_key,selected_model,base_url
           FROM provider_connections
           WHERE user_id=$1 AND active=true AND selected_model IS NOT NULL
           ORDER BY last_checked_at DESC NULLS LAST,provider LIMIT 1`,
          [user],
        ),
      ]);
      if (connections.rowCount) {
        try {
          const context = await loadTrackerContext(client, user);
          const readiness = buildTrackerReadiness(context);
          const connection = connections.rows[0];
          const provider = providerSchema.parse(connection.provider);
          const apiKey = connection.encrypted_api_key ? decryptSecret(connection.encrypted_api_key) : undefined;
          const result = await generateText({
            model: getModel(provider, connection.selected_model, apiKey, connection.base_url),
            maxRetries: 0,
            system: "Score this job opportunity for CareerGroove. Use only supplied facts. Return only JSON with fit, readiness, desire, leverage, risk, timing, label, reasons, gaps, nextAction, nextActionReason. Labels and actions must match the product contract. Never invent candidate experience.",
            prompt: JSON.stringify({ application: application.rows[0], context, userPreferences: preferences.rows[0]?.preferences ?? {}, deterministicScore: score }),
          });
          const parsed = aiScoreSchema.parse(jsonFromText(result.text));
          const inserted = await client.query(
            `INSERT INTO application_scores(user_id,application_id,fit,readiness,desire,leverage,risk,timing,label,reasons,gaps,next_action,model,context_snapshot)
             VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14::jsonb)
             RETURNING id,label,fit,readiness,desire,leverage,risk,timing,reasons,gaps,next_action AS "nextAction",created_at AS "createdAt"`,
            [
              user, id.data, parsed.fit, parsed.readiness, parsed.desire, parsed.leverage, parsed.risk, parsed.timing, parsed.label,
              JSON.stringify(parsed.reasons), JSON.stringify(parsed.gaps), parsed.nextAction, connection.selected_model,
              JSON.stringify({ trackerReadiness: readiness.score, aiProvider: provider, deterministicScore: score.latestScore }),
            ],
          );
          await client.query(
            `UPDATE applications SET priority_label=$3,next_action_type=$4,next_action_reason=$5,updated_at=now()
             WHERE id=$1 AND user_id=$2`,
            [id.data, user, parsed.label, parsed.nextAction, parsed.nextActionReason],
          );
          await client.query("COMMIT");
          return Response.json({
            latestScore: inserted.rows[0],
            nextActionType: parsed.nextAction,
            nextActionReason: parsed.nextActionReason,
            priorityLabel: parsed.label,
            trackerReadiness: readiness,
            ai: true,
          });
        } catch (error) {
          console.error("AI Career DJ scoring fell back to deterministic scoring", error);
        }
      }
    }
    await client.query("COMMIT");
    return Response.json({ ...score, ai: false });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Application scoring failed", error);
    return Response.json({ error: "The role could not be rescored." }, { status: 500 });
  } finally {
    client.release();
  }
}
