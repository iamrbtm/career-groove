import { redirect } from "@sveltejs/kit";
import { db } from "#lib/server/db";
import { eq } from "drizzle-orm";
import { applications } from "#lib/server/db/schema";
import { deleteDocument, getDocument, updateDocument } from "#lib/server/documents";
import { getProfile } from "#lib/server/profile";

export async function load({ locals, params }: { locals: App.Locals; params: { id: string } }) {
  const user = locals.user!;
  const row = await getDocument(user.id, params.id);
  if (!row) redirect(303, "/documents");
  const profile = await getProfile(user.id, user.name);
  return {
    document: row.document,
    application: row.application,
    profile,
    applications: await db
      .select({ id: applications.id, company: applications.company, title: applications.title })
      .from(applications)
      .where(eq(applications.userId, user.id)),
  };
}

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}
function optional(form: FormData, key: string) {
  return value(form, key) || null;
}

export const actions = {
  update: async ({ request, locals, params }: { request: Request; locals: App.Locals; params: { id: string } }) => {
    const user = locals.user!;
    const form = await request.formData();
    await updateDocument(user.id, params.id, {
      applicationId: optional(form, "applicationId"),
      kind: value(form, "kind") || "resume",
      title: value(form, "title"),
      bodyMarkdown: value(form, "bodyMarkdown"),
    });
    redirect(303, `/documents/${params.id}`);
  },

  delete: async ({ locals, params }: { locals: App.Locals; params: { id: string } }) => {
    const user = locals.user!;
    await deleteDocument(user.id, params.id);
    redirect(303, "/documents");
  },
};