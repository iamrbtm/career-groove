import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { applications, documents } from "./db/schema";

export async function listDocuments(userId: string) {
  return db
    .select({
      id: documents.id,
      applicationId: documents.applicationId,
      kind: documents.kind,
      title: documents.title,
      updatedAt: documents.updatedAt,
      company: applications.company,
      roleTitle: applications.title,
    })
    .from(documents)
    .leftJoin(applications, eq(documents.applicationId, applications.id))
    .where(eq(documents.userId, userId))
    .orderBy(desc(documents.updatedAt));
}

export async function getDocument(userId: string, id: string) {
  const [row] = await db
    .select({ document: documents, application: applications })
    .from(documents)
    .leftJoin(applications, eq(documents.applicationId, applications.id))
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createDocument(
  userId: string,
  input: {
    applicationId?: string | null;
    kind?: string;
    title: string;
    bodyMarkdown?: string;
  },
) {
  const [row] = await db
    .insert(documents)
    .values({
      userId,
      applicationId: input.applicationId ?? null,
      kind: input.kind ?? "resume",
      title: input.title,
      bodyMarkdown: input.bodyMarkdown ?? "",
    })
    .returning();
  return row;
}

export async function updateDocument(
  userId: string,
  id: string,
  input: { applicationId?: string | null; kind?: string; title: string; bodyMarkdown: string },
) {
  const [row] = await db
    .update(documents)
    .set({
      applicationId: input.applicationId ?? null,
      kind: input.kind ?? "resume",
      title: input.title,
      bodyMarkdown: input.bodyMarkdown,
      updatedAt: new Date(),
    })
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteDocument(userId: string, id: string) {
  await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, userId)));
}

export function baseResumeMarkdown(profile: {
  name: string | null;
  phone: string | null;
  linkedin: string | null;
  github: string | null;
  portfolio: string | null;
  website: string | null;
}) {
  return `# ${profile.name ?? "Your Name"}

${[profile.phone, profile.linkedin, profile.github, profile.portfolio, profile.website]
  .filter(Boolean)
  .join(" · ")}

## Summary

Add a short positioning statement here.

## Experience

## Skills

## Education
`;
}
