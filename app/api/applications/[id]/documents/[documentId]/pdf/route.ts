import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { requireUser, unauthorized } from "@/lib/api-auth";
import { createCoverLetterPdf } from "@/lib/cover-letter-pdf";
import { db } from "@/lib/db";
import { createResumePdf, type ResumeData } from "@/lib/resume-pdf";

const paramsSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const userId = await requireUser();
  if (!userId) return unauthorized();

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "Invalid document." }, { status: 400 });

  const result = await db.query(
    `SELECT ad.kind,ad.title,ad.document_id AS "documentId",ad.document_generation_job_id AS "jobId",
      COALESCE(d.content->>'text',
        CASE
          WHEN ad.kind='resume' THEN j.result->>'resume'
          WHEN ad.kind='cover_letter' THEN j.result->>'cover_letter'
          ELSE NULL
        END
      ) AS text,
      COALESCE(d.content->'resumeData', j.result->'resumeData') AS "resumeData",
      COALESCE(d.target_job, j.target_job, '{}'::jsonb) AS "targetJob",
      a.title AS "applicationTitle",a.company AS "applicationCompany",
      u.name,u.email,u.preferences,
      (SELECT address FROM residences WHERE user_id=u.id ORDER BY ended_on IS NULL DESC,started_on DESC NULLS LAST LIMIT 1) AS address
     FROM application_documents ad
     JOIN applications a ON a.id=ad.application_id AND a.user_id=ad.user_id
     JOIN users u ON u.id=ad.user_id
     LEFT JOIN documents d ON d.id=ad.document_id AND d.user_id=ad.user_id
     LEFT JOIN document_generation_jobs j ON j.id=ad.document_generation_job_id AND j.user_id=ad.user_id
     WHERE ad.id=$1 AND ad.application_id=$2 AND ad.user_id=$3 AND ad.status<>'archived'`,
    [parsed.data.documentId, parsed.data.id, userId],
  );

  if (!result.rowCount) return Response.json({ error: "Document not found." }, { status: 404 });

  const row = result.rows[0];
  const location = row.address && typeof row.address === "object"
    ? ([row.address.city, row.address.region].filter(Boolean).join(", ") || row.address.country || "")
    : "";

  const candidate = {
    name: row.name || "CareerGroove",
    email: row.email || "",
    phone: typeof row.preferences?.phone === "string" ? row.preferences.phone : undefined,
    location,
  };
  const title = row.targetJob?.title || row.applicationTitle;
  const company = row.targetJob?.company || row.applicationCompany;

  if (row.kind === "resume") {
    const resume = row.resumeData as ResumeData | undefined;
    if (!resume) {
      return Response.json({ error: "This resume draft has no PDF layout data. Generate it again to download the PDF." }, { status: 409 });
    }
    const bytes = await createResumePdf({ candidate, resume, targetTitle: title });
    return pdfResponse(bytes, `${safeFileName(candidate.name)}-Resume.pdf`);
  }

  if (row.kind === "cover_letter") {
    if (typeof row.text !== "string" || !row.text.trim()) {
      return Response.json({ error: "This cover letter draft is empty." }, { status: 409 });
    }
    const signaturePath = path.join(process.cwd(), "signature.png");
    const signatureImage = await readFile(signaturePath);
    const bytes = await createCoverLetterPdf({
      candidate,
      targetTitle: title,
      targetCompany: company,
      body: row.text,
      signatureImage,
    });
    return pdfResponse(bytes, `${safeFileName(candidate.name)}-Cover-Letter.pdf`);
  }

  return Response.json({ error: "PDF download is only available for resumes and cover letters." }, { status: 400 });
}

function pdfResponse(bytes: Uint8Array<ArrayBufferLike>, fileName: string) {
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
