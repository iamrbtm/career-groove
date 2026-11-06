import { fail, redirect } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { db } from "#lib/server/db";
import {
  applicationContacts,
  applicationEvents,
  applications,
  contacts,
  interviews,
  researchNotes,
} from "#lib/server/db/schema";
import {
  ACTION_TYPES,
  actionLabels,
  addEvent,
  changeStage,
  completeNextAction,
  getApplication,
  isActionType,
  isOutcome,
  isStage,
  stageLabels,
  type ActionType,
  type Stage,
} from "#lib/server/applications";

export async function load({ locals, params }: { locals: App.Locals; params: { id: string } }) {
  const user = locals.user!;
  const data = await getApplication(user.id, params.id);
  if (!data) redirect(303, "/applications");
  const allContacts = await db.select().from(contacts).where(eq(contacts.userId, user.id));
  return {
    ...data,
    allContacts,
    stages: Object.entries(stageLabels),
    actionLabels,
  };
}

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function optional(form: FormData, key: string) {
  return value(form, key) || null;
}

function numberOrNull(form: FormData, key: string) {
  const raw = value(form, key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
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
    const company = value(form, "company");
    const title = value(form, "title");
    if (!company || !title) return fail(400, { error: "Company and role title are required." });
    await db
      .update(applications)
      .set({
        company,
        title,
        location: optional(form, "location"),
        workMode: optional(form, "workMode"),
        salaryMin: numberOrNull(form, "salaryMin"),
        salaryMax: numberOrNull(form, "salaryMax"),
        sourceUrl: optional(form, "sourceUrl"),
        jobDescription: optional(form, "jobDescription"),
        fitSummary: optional(form, "fitSummary"),
        updatedAt: new Date(),
      })
      .where(and(eq(applications.id, params.id), eq(applications.userId, user.id)));
    redirect(303, `/applications/${params.id}`);
  },

  stage: async ({ request, locals, params }: { request: Request; locals: App.Locals; params: { id: string } }) => {
    const user = locals.user!;
    const form = await request.formData();
    const stageValue = value(form, "stage");
    const outcomeValue = optional(form, "outcome");
    if (!isStage(stageValue)) return fail(400, { error: "Choose a valid stage." });
    if (outcomeValue && !isOutcome(outcomeValue)) return fail(400, { error: "Choose a valid outcome." });
    const result = await changeStage(user.id, params.id, stageValue, outcomeValue);
    if (!result.ok) return fail(400, { error: result.error });
    redirect(303, `/applications/${params.id}`);
  },

  next: async ({ request, locals, params }: { request: Request; locals: App.Locals; params: { id: string } }) => {
    const user = locals.user!;
    const form = await request.formData();
    const typeValue = optional(form, "nextType");
    if (!typeValue) {
      await db
        .update(applications)
        .set({ nextActionType: null, nextActionDueAt: null, nextActionNote: null, updatedAt: new Date() })
        .where(and(eq(applications.id, params.id), eq(applications.userId, user.id)));
      redirect(303, `/applications/${params.id}`);
    }
    if (!isActionType(typeValue)) return fail(400, { error: "Choose a valid action type." });
    await db
      .update(applications)
      .set({
        nextActionType: typeValue,
        nextActionDueAt: dateOrNull(form, "nextDue"),
        nextActionNote: optional(form, "nextNote"),
        updatedAt: new Date(),
      })
      .where(and(eq(applications.id, params.id), eq(applications.userId, user.id)));
    await addEvent(user.id, params.id, "action_set", `Next action: ${actionLabels[typeValue]}`, optional(form, "nextNote"));
    redirect(303, `/applications/${params.id}`);
  },

  complete: async ({ request, locals, params }: { request: Request; locals: App.Locals; params: { id: string } }) => {
    const user = locals.user!;
    const form = await request.formData();
    const typeValue = optional(form, "nextType");
    let next: { type: ActionType; dueAt: Date; note?: string | null } | null = null;
    if (typeValue && isActionType(typeValue)) {
      next = {
        type: typeValue,
        dueAt: dateOrNull(form, "nextDue") ?? new Date(Date.now() + 2 * 86400000),
        note: optional(form, "nextNote"),
      };
    }
    await completeNextAction(user.id, params.id, next);
    redirect(303, `/applications/${params.id}`);
  },

  note: async ({ request, locals, params }: { request: Request; locals: App.Locals; params: { id: string } }) => {
    const user = locals.user!;
    const form = await request.formData();
    const body = value(form, "body");
    if (!body) return fail(400, { error: "Write a note first." });
    await addEvent(user.id, params.id, "note", "Note", body);
    redirect(303, `/applications/${params.id}`);
  },

  addInterview: async ({ request, locals, params }: { request: Request; locals: App.Locals; params: { id: string } }) => {
    const user = locals.user!;
    const form = await request.formData();
    const scheduledAt = dateOrNull(form, "scheduledAt");
    const round = value(form, "round") || "screen";
    const [row] = await db
      .insert(interviews)
      .values({
        userId: user.id,
        applicationId: params.id,
        round,
        scheduledAt,
        location: optional(form, "location"),
        meetingUrl: optional(form, "meetingUrl"),
        interviewerName: optional(form, "interviewerName"),
        interviewerEmail: optional(form, "interviewerEmail"),
        prepNotes: optional(form, "prepNotes"),
      })
      .returning();
    await addEvent(user.id, params.id, "interview_added", `Interview added: ${round}`, optional(form, "scheduledAt"));
    redirect(303, `/interview/${row.id}`);
  },

  addResearch: async ({ request, locals, params }: { request: Request; locals: App.Locals; params: { id: string } }) => {
    const user = locals.user!;
    const form = await request.formData();
    const title = value(form, "title");
    if (!title) return fail(400, { error: "Give the research note a title." });
    await db.insert(researchNotes).values({
      userId: user.id,
      applicationId: params.id,
      company: optional(form, "company"),
      title,
      body: value(form, "body"),
      sourceUrl: optional(form, "sourceUrl"),
    });
    redirect(303, `/applications/${params.id}`);
  },

  linkContact: async ({ request, locals, params }: { request: Request; locals: App.Locals; params: { id: string } }) => {
    const user = locals.user!;
    const form = await request.formData();
    const contactId = value(form, "contactId");
    if (!contactId) return fail(400, { error: "Choose a contact." });
    await db
      .insert(applicationContacts)
      .values({
        applicationId: params.id,
        contactId,
        relationship: optional(form, "relationship"),
        notes: optional(form, "notes"),
      })
      .onConflictDoNothing();
    redirect(303, `/applications/${params.id}`);
  },

  addContact: async ({ request, locals, params }: { request: Request; locals: App.Locals; params: { id: string } }) => {
    const user = locals.user!;
    const form = await request.formData();
    const name = value(form, "name");
    if (!name) return fail(400, { error: "Contact name is required." });
    const [contact] = await db
      .insert(contacts)
      .values({
        userId: user.id,
        name,
        email: optional(form, "email"),
        phone: optional(form, "phone"),
        company: optional(form, "company"),
        role: optional(form, "role"),
        notes: optional(form, "notes"),
      })
      .returning();
    await db.insert(applicationContacts).values({
      applicationId: params.id,
      contactId: contact.id,
      relationship: optional(form, "relationship"),
    });
    redirect(303, `/applications/${params.id}`);
  },

  archive: async ({ locals, params }: { locals: App.Locals; params: { id: string } }) => {
    const user = locals.user!;
    await db
      .update(applications)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(applications.id, params.id), eq(applications.userId, user.id)));
    redirect(303, "/applications");
  },
};
