import { generateText } from "ai";
import { z } from "zod";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getModel } from "@/lib/ai";
import { decryptSecret } from "@/lib/secret-box";
import { providerSchema } from "@/lib/provider-models";
import { parseChapterAI } from "@/lib/chapter-ai";

const AI_MAX_RETRIES = 0;

const idSchema = z.string().uuid();
const draftSchema = z.object({
  company: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(160),
  location: z.string().trim().max(160).optional(),
  rawNotes: z.string().trim().min(1).max(30000),
});

function polishedSection(text: string) {
  const match = text.match(/POLISHED_CHAPTER\s*\n([\s\S]*?)(?=\n\s*BULLETS\s*\n)/i);
  return match?.[1].trim() || "";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const id = idSchema.safeParse((await params).id);
  const draft = draftSchema.safeParse(await request.json());
  if (!id.success || !draft.success) return Response.json({ error: "Add some original-story details before re-processing." }, { status: 400 });

  const result = await db.query(
    `SELECT j.metadata,u.preferences FROM jobs j JOIN users u ON u.id=j.user_id WHERE j.id=$1 AND j.user_id=$2`,
    [id.data, userId],
  );
  if (!result.rowCount) return Response.json({ error: "Chapter not found" }, { status: 404 });
  const preferred = providerSchema.safeParse(result.rows[0].preferences?.aiProvider);
  const connection = await db.query(
    `SELECT provider,encrypted_api_key,selected_model,base_url FROM provider_connections
     WHERE user_id=$1 AND active=true AND selected_model IS NOT NULL
     ORDER BY (provider=$2) DESC,updated_at DESC LIMIT 1`,
    [userId, preferred.success ? preferred.data : ""],
  );
  if (!connection.rowCount) return Response.json({ error: "Connect and select an AI provider in Settings first." }, { status: 409 });

  const selected = connection.rows[0];
  const provider = providerSchema.parse(selected.provider);
  let apiKey: string | undefined;
  try { apiKey = selected.encrypted_api_key ? decryptSecret(selected.encrypted_api_key) : undefined; }
  catch { return Response.json({ error: `Reconnect ${provider} in Settings before re-processing.` }, { status: 409 }); }

  const prompt = `Rewrite this work history into a polished, factual career chapter. Preserve every supported detail and generate as many distinct resume bullets as the content warrants; never impose a fixed count. Never invent facts, numbers, or outcomes. Output exactly these sections:\nPOLISHED_CHAPTER\nA cohesive detailed narrative in plain text.\nBULLETS\nOne resume-ready bullet per line.\nSKILLS\nOne skill per line as Canonical Skill Name | category_key. Allowed categories: interpersonal_behavioral, cognitive_methodological, technical_digital, business_operational, specialized_vocational, other. No Markdown markers or commentary.`;
  try {
    const generated = await generateText({
      model: getModel(provider, selected.selected_model, apiKey, selected.base_url),
      maxRetries: AI_MAX_RETRIES,
      system: prompt,
      messages: [{ role: "user", content: JSON.stringify(draft.data) }],
    });
    const polishedChapter = polishedSection(generated.text);
    const parsed = parseChapterAI(generated.text.replace(/^POLISHED_CHAPTER\s*\n[\s\S]*?\n\s*BULLETS\s*\n/i, "BULLETS\n"));
    if (!polishedChapter || !parsed.bullets.length) throw new Error("The model returned an incomplete chapter");

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const metadata = { ...(result.rows[0].metadata || {}), polishedChapter, lastReprocessedAt: new Date().toISOString(), lastReprocessedProvider: provider, lastReprocessedModel: selected.selected_model };
      const updated = await client.query(
        `UPDATE jobs SET company=$3,title=$4,location=$5,raw_notes=$6,achievements=$7::jsonb,metadata=$8::jsonb,updated_at=now()
         WHERE id=$1 AND user_id=$2 RETURNING id,company,title,location,started_on AS "startedOn",ended_on AS "endedOn",COALESCE(current, false) AS "current",raw_notes AS "rawNotes",achievements,metadata,updated_at AS "updatedAt"`,
        [id.data, userId, draft.data.company, draft.data.title, draft.data.location || null, draft.data.rawNotes, JSON.stringify(parsed.bullets), JSON.stringify(metadata)],
      );
      await client.query("DELETE FROM job_skills WHERE job_id=$1", [id.data]);
      for (const skillInput of parsed.skills) {
        const skill = await client.query(
          `INSERT INTO skills(user_id,name,proficiency,category) VALUES($1,$2,3,$3)
           ON CONFLICT (user_id,lower(name)) DO UPDATE SET updated_at=now() RETURNING id`,
          [userId, skillInput.name, skillInput.category],
        );
        await client.query("INSERT INTO job_skills(job_id,skill_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [id.data, skill.rows[0].id]);
      }
      await client.query("COMMIT");
      return Response.json({ job: updated.rows[0] });
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  } catch (error) {
    console.error("Chapter re-processing failed", error);
    return Response.json({ error: "AI could not re-process this chapter. Your existing polished chapter was left unchanged." }, { status: 502 });
  }
}
