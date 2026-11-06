import { redirect } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { db } from "#lib/server/db";
import { followUps } from "#lib/server/db/schema";

export async function load({ locals, params }: { locals: App.Locals; params: { id: string } }) {
  const user = locals.user!;
  const [row] = await db
    .select()
    .from(followUps)
    .where(and(eq(followUps.id, params.id), eq(followUps.userId, user.id)))
    .limit(1);
  if (!row) redirect(303, "/follow-ups");
  return { followUp: row };
}

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}
function optional(form: FormData, key: string) {
  return value(form, key) || null;
}
function dateOrNull(form: FormData, key: string) {
  const raw = value(form, key);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export const actions = {
  update: async ({ request, locals, params }: { request: Request; locals: App.Locals; params: { id: string } }) => {
    const user = locals.user!;
    const form = await request.formData();
    await db
      .update(followUps)
      .set({
        subject: value(form, "subject"),
        body: value(form, "body"),
        dueAt: dateOrNull(form, "dueAt"),
      })
      .where(and(eq(followUps.id, params.id), eq(followUps.userId, user.id)));
    redirect(303, `/follow-ups/${params.id}`);
  },

  delete: async ({ locals, params }: { locals: App.Locals; params: { id: string } }) => {
    const user = locals.user!;
    await db.delete(followUps).where(and(eq(followUps.id, params.id), eq(followUps.userId, user.id)));
    redirect(303, "/follow-ups");
  },
};