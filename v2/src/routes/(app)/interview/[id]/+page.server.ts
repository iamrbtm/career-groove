import { redirect } from "@sveltejs/kit";
import { and, desc, eq } from "drizzle-orm";
import { db } from "#lib/server/db";
import { researchNotes } from "#lib/server/db/schema";
import { deleteInterview, getInterview, mockQuestions, updateInterview } from "#lib/server/interviews";

export async function load({ locals, params }: { locals: App.Locals; params: { id: string } }) {
  const user = locals.user!;
  const row = await getInterview(user.id, params.id);
  if (!row) redirect(303, "/interview");
  const research = row.application
    ? await db
        .select()
        .from(researchNotes)
        .where(
          and(
            eq(researchNotes.userId, user.id),
            eq(researchNotes.applicationId, row.application.id),
          ),
        )
        .orderBy(desc(researchNotes.updatedAt))
    : [];
  return {
    interview: row.interview,
    application: row.application,
    research,
    questions: mockQuestions(row.interview.round),
  };
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
    await updateInterview(user.id, params.id, {
      round: value(form, "round") || "screen",
      scheduledAt: dateOrNull(form, "scheduledAt"),
      location: optional(form, "location"),
      meetingUrl: optional(form, "meetingUrl"),
      interviewerName: optional(form, "interviewerName"),
      interviewerEmail: optional(form, "interviewerEmail"),
      prepNotes: optional(form, "prepNotes"),
      status: value(form, "status") || "scheduled",
    });
    redirect(303, `/interview/${params.id}`);
  },

  delete: async ({ locals, params }: { locals: App.Locals; params: { id: string } }) => {
    const user = locals.user!;
    await deleteInterview(user.id, params.id);
    redirect(303, "/interview");
  },
};
