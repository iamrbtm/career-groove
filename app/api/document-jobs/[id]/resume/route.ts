import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { createResumePdf, type ResumeData } from "@/lib/resume-pdf";

const idSchema = z.string().uuid();

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: "Invalid document job." }, { status: 400 });

  const result = await db.query(
    `SELECT j.result,j.target_job AS "targetJob",u.name,u.email,u.preferences,
      (SELECT address FROM residences WHERE user_id=u.id ORDER BY ended_on IS NULL DESC,started_on DESC NULLS LAST LIMIT 1) AS address
     FROM document_generation_jobs j JOIN users u ON u.id=j.user_id
     WHERE j.id=$1 AND j.user_id=$2 AND j.status='completed'`,
    [id.data, userId],
  );
  if (!result.rowCount) return Response.json({ error: "Completed resume not found." }, { status: 404 });

  const row = result.rows[0];
  const resume = row.result?.resumeData as ResumeData | undefined;
  if (!resume) return Response.json({ error: "This older draft has no PDF layout data. Generate it again to download the one-page PDF." }, { status: 409 });

  const location = row.address && typeof row.address === "object"
    ? ([row.address.city, row.address.region].filter(Boolean).join(", ") || row.address.country || "")
    : "";
  const bytes = await createResumePdf({
    candidate: {
      name: row.name || "Resume",
      email: row.email || "",
      phone: typeof row.preferences?.phone === "string" ? row.preferences.phone : undefined,
      location,
    },
    resume,
    targetTitle: row.targetJob?.title,
  });
  const fileName = `${safeFileName(row.name || "CareerGroove")}-Resume.pdf`;
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

function safeFileName(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "CareerGroove";
}
