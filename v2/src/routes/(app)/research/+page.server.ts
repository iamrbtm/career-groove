import { redirect } from "@sveltejs/kit";
import { and, desc, eq } from "drizzle-orm";
import { db } from "#lib/server/db";
import { researchNotes } from "#lib/server/db/schema";

export async function load({ locals }: { locals: App.Locals }) {
  const user = locals.user!;
  const rows = await db
    .select()
    .from(researchNotes)
    .where(eq(researchNotes.userId, user.id))
    .orderBy(desc(researchNotes.updatedAt));
  return { notes: rows };
}

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}
function optional(form: FormData, key: string) {
  return value(form, key) || null;
}

export const actions = {
  add: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    const title = value(form, "title");
    if (!title) return { error: "Title is required." };
    await db.insert(researchNotes).values({
      userId: user.id,
      applicationId: optional(form, "applicationId"),
      company: optional(form, "company"),
      title,
      body: value(form, "body"),
      sourceUrl: optional(form, "sourceUrl"),
    });
    redirect(303, "/research");
  },
};