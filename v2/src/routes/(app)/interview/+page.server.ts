import { redirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import { db } from "#lib/server/db";
import { applications } from "#lib/server/db/schema";
import { createInterview, deleteInterview, listInterviews } from "#lib/server/interviews";

export async function load({ locals }: { locals: App.Locals }) {
  const user = locals.user!;
  const [rows, apps] = await Promise.all([
    listInterviews(user.id),
    db
      .select({ id: applications.id, company: applications.company, title: applications.title })
      .from(applications)
      .where(eq(applications.userId, user.id)),
  ]);
  return { interviews: rows, applications: apps };
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
  add: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    const interview = await createInterview(user.id, {
      applicationId: optional(form, "applicationId"),
      round: value(form, "round") || "screen",
      scheduledAt: dateOrNull(form, "scheduledAt"),
      location: optional(form, "location"),
      meetingUrl: optional(form, "meetingUrl"),
      interviewerName: optional(form, "interviewerName"),
      interviewerEmail: optional(form, "interviewerEmail"),
      prepNotes: optional(form, "prepNotes"),
    });
    redirect(303, `/interview/${interview.id}`);
  },

  delete: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    await deleteInterview(user.id, value(form, "id"));
    redirect(303, "/interview");
  },
};
