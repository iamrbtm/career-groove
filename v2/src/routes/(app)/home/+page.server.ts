import { redirect } from "@sveltejs/kit";
import {
  ACTION_TYPES,
  actionLabels,
  completeNextAction,
  defaultAction,
  dueActions,
  getStageCounts,
  isActionType,
  snoozeNextAction,
  upcomingActions,
  upcomingInterviews,
} from "#lib/server/applications";

export async function load({ locals }: { locals: App.Locals }) {
  const user = locals.user!;
  const [stageCounts, due, upcoming, interviews] = await Promise.all([
    getStageCounts(user.id),
    dueActions(user.id),
    upcomingActions(user.id, 7),
    upcomingInterviews(user.id, 14),
  ]);

  const active = Object.values(stageCounts).reduce((total, n) => total + n, 0);
  const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const interviewsThisWeek = interviews.filter(
    (interview) =>
      interview.scheduledAt && new Date(interview.scheduledAt) <= weekEnd,
  ).length;

  return {
    user,
    stageCounts,
    active,
    due,
    upcoming,
    interviews,
    interviewsThisWeek,
    actionLabels,
  };
}

export const actions = {
  complete: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    const type = String(form.get("nextType") ?? "");
    const due = String(form.get("nextDue") ?? "");
    const note = String(form.get("nextNote") ?? "");

    let next: { type: (typeof ACTION_TYPES)[number]; dueAt: Date; note?: string | null } | null =
      null;
    if (id && isActionType(type)) {
      next = {
        type,
        dueAt: due ? new Date(`${due}T12:00:00`) : defaultAction("applied").dueAt,
        note: note || null,
      };
    }
    await completeNextAction(user.id, id, next);
    redirect(303, "/home");
  },

  snooze: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    if (id) await snoozeNextAction(user.id, id, 2);
    redirect(303, "/home");
  },
};
