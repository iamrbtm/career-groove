import { redirect } from "@sveltejs/kit";
import { db } from "#lib/server/db";
import { eq } from "drizzle-orm";
import { applications } from "#lib/server/db/schema";
import { createDocument, deleteDocument, listDocuments } from "#lib/server/documents";
import { getProfile } from "#lib/server/profile";

export async function load({ locals }: { locals: App.Locals }) {
  const user = locals.user!;
  const [docs, profile, apps] = await Promise.all([
    listDocuments(user.id),
    getProfile(user.id, user.name),
    db
      .select({ id: applications.id, company: applications.company, title: applications.title })
      .from(applications)
      .where(eq(applications.userId, user.id)),
  ]);
  return { documents: docs, profile, applications: apps };
}

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}
function optional(form: FormData, key: string) {
  return value(form, key) || null;
}

export const actions = {
  create: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    const title = value(form, "title");
    if (!title) return { error: "Title is required." };
    const doc = await createDocument(user.id, {
      applicationId: optional(form, "applicationId"),
      kind: value(form, "kind") || "resume",
      title,
      bodyMarkdown: value(form, "bodyMarkdown"),
    });
    redirect(303, `/documents/${doc.id}`);
  },

  delete: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    await deleteDocument(user.id, value(form, "id"));
    redirect(303, "/documents");
  },
};