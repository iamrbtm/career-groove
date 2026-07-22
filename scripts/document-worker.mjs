import { createDecipheriv, createHash } from "node:crypto";
import pg from "pg";
import { generateObject, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const DOCUMENT_MAX_RETRIES = 0;

const resumeSchema = z.object({
  summary: z.string().describe("A targeted professional summary of no more than 65 words."),
  education: z.array(z.object({
    name: z.string().describe("Degree, program, or field of study."),
    issuer: z.string().optional().describe("School or institution."),
    location: z.string().optional(),
    date: z.string().optional().describe("Concise graduation or attendance date copied from the source."),
    details: z.string().optional().describe("Optional relevant detail, no more than 18 words."),
  })).max(4),
  workExperience: z.array(z.object({
    company: z.string(),
    title: z.string(),
    location: z.string().optional(),
    startDate: z.string().optional().describe("Concise month/year or year copied from the source."),
    endDate: z.string().optional().describe("Concise month/year, year, or Present copied from the source."),
    highlights: z.array(z.string().describe("One factual, role-relevant accomplishment or responsibility of no more than 24 words.")).min(1).max(3),
  })).min(1).max(5),
  certifications: z.array(z.object({
    name: z.string(),
    issuer: z.string().optional(),
    date: z.string().optional().describe("Issue or expiration date copied from the source when useful."),
    details: z.string().optional().describe("Optional relevant detail, no more than 18 words."),
  })).max(6),
  skills: z.array(z.string().describe("A concise, verified skill from the supplied skill inventory that directly matches the target role.")).max(10),
});

function decrypt(value) {
  const secret = process.env.PROVIDER_ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) throw new Error("Provider encryption is not configured.");
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Invalid encrypted secret.");
  const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(secret).digest(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

function modelFor(connection) {
  const key = connection.encrypted_api_key ? decrypt(connection.encrypted_api_key) : undefined;
  if (connection.provider === "anthropic") return createAnthropic({ apiKey: key || process.env.ANTHROPIC_API_KEY })(connection.selected_model);
  if (connection.provider === "google") return createGoogleGenerativeAI({ apiKey: key || process.env.GOOGLE_GENERATIVE_AI_API_KEY })(connection.selected_model);
  if (connection.provider === "ollama") {
    const root = (connection.base_url || process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/api\/?$/, "").replace(/\/$/, "");
    return createOpenAI({ baseURL: `${root}/v1`, apiKey: key || "ollama" })(connection.selected_model);
  }
  return createOpenAI({ apiKey: key || process.env.OPENAI_API_KEY })(connection.selected_model);
}

function normalizeProviderError(error, provider) {
  if (!(error instanceof Error)) return new Error("Document generation failed.");
  const message = error.message || "Document generation failed.";
  const statusCode = typeof error === "object" && error && "statusCode" in error ? error.statusCode : undefined;
  const data = typeof error === "object" && error && "data" in error ? error.data : undefined;
  const code = data && typeof data === "object" && "error" in data && data.error && typeof data.error === "object" ? data.error.code : undefined;

  if (code === "insufficient_quota" || (statusCode === 429 && /quota/i.test(message))) {
    return new Error(`${provider} quota is exhausted. Connect another active provider in Settings or update your billing plan.`);
  }
  if (statusCode === 401 || statusCode === 403) {
    return new Error(`${provider} authentication failed. Reconnect it in Settings before generating documents.`);
  }
  return new Error(message);
}

async function claim() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE document_generation_jobs
       SET status=CASE WHEN attempts < 3 THEN 'queued' ELSE 'failed' END,
           error=CASE WHEN attempts < 3 THEN error ELSE 'Generation stopped unexpectedly after three attempts.' END,
           completed_at=CASE WHEN attempts < 3 THEN completed_at ELSE now() END,updated_at=now()
       WHERE status='processing' AND started_at < now() - interval '15 minutes'`,
    );
    const found = await client.query(`SELECT * FROM document_generation_jobs WHERE status='queued' AND archived_at IS NULL ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`);
    if (!found.rowCount) { await client.query("COMMIT"); return null; }
    const job = found.rows[0];
    await client.query(`UPDATE document_generation_jobs SET status='processing',started_at=now(),updated_at=now(),attempts=attempts+1 WHERE id=$1`, [job.id]);
    await client.query("COMMIT");
    return job;
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function run(job) {
  const connections = await pool.query(
    `SELECT provider,encrypted_api_key,selected_model,base_url FROM provider_connections
     WHERE user_id=$1 AND active=true AND selected_model IS NOT NULL ORDER BY last_checked_at DESC NULLS LAST`,
    [job.user_id],
  );
  if (!connections.rowCount) throw new Error("Connect and select an AI provider in Settings first.");
  const kinds = job.kind === "both" ? ["resume", "cover_letter"] : [job.kind];
  const result = {};
  for (const kind of kinds) {
    let lastError;
    for (const connection of connections.rows) {
      try {
        if (kind === "resume") {
          const generated = await generateObject({
            model: modelFor(connection),
            maxRetries: DOCUMENT_MAX_RETRIES,
            schema: resumeSchema,
            system: `Create a precise, ATS-friendly, one-page resume using only the supplied facts. Tailor the summary and work highlights to the target role without inventing facts, metrics, dates, credentials, or skills. Rank work entries, highlights, and skills from most to least relevant because the PDF formatter may remove final items to keep one page. Prefer concise evidence over generic claims. Include a certification only when the job description requests or prefers it, or when it is clearly relevant to the role's stated duties; otherwise return an empty certifications array. Choose skills only from the supplied skill inventory and only when they match the job description. When certifications is empty, provide the strongest matching skills as the replacement section. When certifications is not empty, still return matching skills so the formatter can include them if space permits.\nTarget role: ${JSON.stringify(job.target_job)}\nCareer context: ${JSON.stringify(job.career_context)}`,
            prompt: "Build the structured, one-page resume. Keep the summary under 65 words, each work highlight under 24 words, and each skill concise.",
          });
          result.resumeData = generated.object;
          result.resume = resumeToText(generated.object);
        } else {
          const generated = await generateText({
            model: modelFor(connection),
            maxRetries: DOCUMENT_MAX_RETRIES,
            system: `Write a specific, human cover letter grounded only in the supplied experience. Use plain text and never invent facts.\nTarget role: ${JSON.stringify(job.target_job)}\nCareer history: ${JSON.stringify(job.career_context)}`,
            prompt: "Create the cover letter for this role.",
          });
          if (!generated.text.trim()) throw new Error("The provider returned an empty response.");
          result.cover_letter = generated.text.trim();
        }
        lastError = undefined;
        break;
      } catch (error) {
        lastError = normalizeProviderError(error, connection.provider);
        console.error("Document provider failed", connection.provider, lastError.message);
      }
    }
    if (lastError) throw lastError;
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const kind of kinds) {
      const text = result[kind];
      const label = kind === "resume" ? "Resume" : "Cover Letter";
      await client.query(
        `INSERT INTO documents(user_id,kind,title,content,target_job) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)`,
        [job.user_id, kind, `${job.target_job.title || job.target_job.company || "Untitled"} ${label}`, JSON.stringify({ text, generationJobId: job.id, ...(kind === "resume" ? { resumeData: result.resumeData } : {}) }), JSON.stringify(job.target_job)],
      );
    }
    await client.query(`UPDATE document_generation_jobs SET status='completed',result=$2::jsonb,error=NULL,completed_at=now(),updated_at=now() WHERE id=$1`, [job.id, JSON.stringify(result)]);
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

function resumeToText(resume) {
  const credentialLine = (item) => [item.issuer, item.name, item.location, item.date, item.details].filter(Boolean).join(" | ");
  const lines = ["SUMMARY", resume.summary, "", "EDUCATION"];
  lines.push(...resume.education.map(credentialLine));
  lines.push("", "WORK EXPERIENCE");
  for (const job of resume.workExperience) {
    lines.push([job.company, job.title, job.location, [job.startDate, job.endDate].filter(Boolean).join(" - ")].filter(Boolean).join(" | "));
    lines.push(...job.highlights.map((highlight) => `• ${highlight}`));
  }
  if (resume.certifications.length) {
    lines.push("", "CERTIFICATIONS");
    lines.push(...resume.certifications.map(credentialLine));
  }
  if (resume.skills.length) {
    lines.push("", "SKILLS", resume.skills.join(" • "));
  }
  return lines.join("\n").trim();
}

console.log("Document worker ready.");
while (true) {
  try {
    const job = await claim();
    if (!job) { await pause(2000); continue; }
    try { await run(job); }
    catch (error) {
      console.error("Document job failed", job.id, error);
      await pool.query(`UPDATE document_generation_jobs SET status='failed',error=$2,completed_at=now(),updated_at=now() WHERE id=$1`, [job.id, error instanceof Error ? error.message.slice(0, 1000) : "Generation failed."]);
    }
  } catch (error) { console.error("Document worker loop failed", error); await pause(5000); }
}
