import { and, asc, count, desc, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "./db";
import {
  actionLabels,
  defaultAction,
  isStage,
  outcomeLabels,
  stageLabels,
  validateStageChange,
  type ActionType,
  type Stage,
  type Outcome,
} from "#lib/workflow";
import {
  applicationContacts,
  applicationEvents,
  applications,
  contacts,
  documents,
  interviews,
  researchNotes,
} from "./db/schema";

export {
  STAGES,
  OUTCOMES,
  ACTION_TYPES,
  stageLabels,
  outcomeLabels,
  actionLabels,
  isStage,
  isOutcome,
  isActionType,
  defaultAction,
  validateStageChange,
  stageBadgeClass,
} from "#lib/workflow";
export type { Stage, Outcome, ActionType } from "#lib/workflow";

export type ApplicationSummary = {
  id: string;
  company: string;
  title: string;
  location: string | null;
  workMode: string | null;
  stage: Stage;
  outcome: string | null;
  nextActionType: string | null;
  nextActionDueAt: Date | null;
  nextActionNote: string | null;
  sourceUrl: string | null;
  updatedAt: Date;
  createdAt: Date;
};

export async function getStageCounts(userId: string) {
  const rows = await db
    .select({ stage: applications.stage, total: count() })
    .from(applications)
    .where(and(eq(applications.userId, userId), isNull(applications.archivedAt)))
    .groupBy(applications.stage);
  const result: Record<Stage, number> = {
    lead: 0,
    preparing: 0,
    applied: 0,
    interviewing: 0,
    decision: 0,
  };
  for (const row of rows) {
    if (isStage(row.stage)) result[row.stage] = Number(row.total);
  }
  return result;
}

export async function listApplications(
  userId: string,
  options: { stage?: Stage; search?: string; due?: boolean } = {},
): Promise<ApplicationSummary[]> {
  const conditions = [eq(applications.userId, userId), isNull(applications.archivedAt)];
  if (options.stage) conditions.push(eq(applications.stage, options.stage));
  if (options.due) {
    conditions.push(lte(applications.nextActionDueAt, sql`now()`));
  }
  if (options.search?.trim()) {
    const term = `%${options.search.trim()}%`;
    conditions.push(
      or(
        ilike(applications.company, term),
        ilike(applications.title, term),
        ilike(applications.location, term),
      )!,
    );
  }
  const rows = await db
    .select({
      id: applications.id,
      company: applications.company,
      title: applications.title,
      location: applications.location,
      workMode: applications.workMode,
      stage: applications.stage,
      outcome: applications.outcome,
      nextActionType: applications.nextActionType,
      nextActionDueAt: applications.nextActionDueAt,
      nextActionNote: applications.nextActionNote,
      sourceUrl: applications.sourceUrl,
      updatedAt: applications.updatedAt,
      createdAt: applications.createdAt,
    })
    .from(applications)
    .where(and(...conditions))
    .orderBy(desc(applications.updatedAt));
  return rows.map((row) => ({ ...row, stage: row.stage as Stage }));
}

export async function getApplication(userId: string, id: string) {
  const [application] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .limit(1);
  if (!application) return null;

  const [events, docs, interviewRows, people, research] = await Promise.all([
    db
      .select()
      .from(applicationEvents)
      .where(eq(applicationEvents.applicationId, id))
      .orderBy(desc(applicationEvents.occurredAt)),
    db
      .select()
      .from(documents)
      .where(and(eq(documents.userId, userId), eq(documents.applicationId, id)))
      .orderBy(desc(documents.updatedAt)),
    db
      .select()
      .from(interviews)
      .where(and(eq(interviews.userId, userId), eq(interviews.applicationId, id)))
      .orderBy(asc(interviews.scheduledAt)),
    db
      .select({
        contact: contacts,
        relationship: applicationContacts.relationship,
        notes: applicationContacts.notes,
      })
      .from(applicationContacts)
      .innerJoin(contacts, eq(applicationContacts.contactId, contacts.id))
      .where(
        and(
          eq(contacts.userId, userId),
          eq(applicationContacts.applicationId, id),
        ),
      ),
    db
      .select()
      .from(researchNotes)
      .where(and(eq(researchNotes.userId, userId), eq(researchNotes.applicationId, id)))
      .orderBy(desc(researchNotes.updatedAt)),
  ]);

  return { application, events, documents: docs, interviews: interviewRows, people, research };
}

export type ApplicationInput = {
  company: string;
  title: string;
  location?: string | null;
  workMode?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  sourceUrl?: string | null;
  jobDescription?: string | null;
  stage?: Stage;
  outcome?: string | null;
  nextActionType?: string | null;
  nextActionDueAt?: Date | null;
  nextActionNote?: string | null;
  fitSummary?: string | null;
};

export async function createApplication(userId: string, input: ApplicationInput) {
  const stage = input.stage ?? "lead";
  const outcome = stage === "decision" ? input.outcome ?? null : null;
  const fallback = defaultAction(stage);
  const nextActionType = input.nextActionType ?? fallback.type;
  const nextActionDueAt = input.nextActionDueAt ?? fallback.dueAt;

  const [application] = await db
    .insert(applications)
    .values({
      userId,
      company: input.company,
      title: input.title,
      location: input.location ?? null,
      workMode: input.workMode ?? null,
      salaryMin: input.salaryMin ?? null,
      salaryMax: input.salaryMax ?? null,
      salaryCurrency: input.salaryCurrency ?? "USD",
      sourceUrl: input.sourceUrl ?? null,
      jobDescription: input.jobDescription ?? null,
      stage,
      outcome,
      nextActionType,
      nextActionDueAt,
      nextActionNote: input.nextActionNote ?? null,
      fitSummary: input.fitSummary ?? null,
    })
    .returning();

  await db.insert(applicationEvents).values({
    userId,
    applicationId: application.id,
    eventType: "created",
    title: `Added ${input.company} — ${input.title}`,
    body: `Started in ${stageLabels[stage]} stage.`,
  });

  return application;
}

export async function updateApplication(userId: string, id: string, input: ApplicationInput) {
  const stage = input.stage ?? "lead";
  const outcome = stage === "decision" ? input.outcome ?? null : null;
  const [updated] = await db
    .update(applications)
    .set({
      company: input.company,
      title: input.title,
      location: input.location ?? null,
      workMode: input.workMode ?? null,
      salaryMin: input.salaryMin ?? null,
      salaryMax: input.salaryMax ?? null,
      salaryCurrency: input.salaryCurrency ?? "USD",
      sourceUrl: input.sourceUrl ?? null,
      jobDescription: input.jobDescription ?? null,
      stage,
      outcome,
      nextActionType: input.nextActionType ?? null,
      nextActionDueAt: input.nextActionDueAt ?? null,
      nextActionNote: input.nextActionNote ?? null,
      fitSummary: input.fitSummary ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .returning();
  return updated ?? null;
}

export async function changeStage(
  userId: string,
  id: string,
  stage: Stage,
  outcome: string | null,
  nextAction?: { type: ActionType; dueAt: Date; note?: string | null },
) {
  const error = validateStageChange(stage, outcome);
  if (error) return { ok: false as const, error };

  const [current] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .limit(1);
  if (!current) return { ok: false as const, error: "Application not found." };

  const seeded: { type: ActionType; dueAt: Date; note?: string | null } =
    nextAction ?? defaultAction(stage);
  const [updated] = await db
    .update(applications)
    .set({
      stage,
      outcome: stage === "decision" ? outcome : null,
      nextActionType: seeded.type,
      nextActionDueAt: seeded.dueAt,
      nextActionNote: seeded.note ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .returning();

  await db.insert(applicationEvents).values({
    userId,
    applicationId: id,
    eventType: "stage_changed",
    title: `${stageLabels[current.stage as Stage] ?? current.stage} → ${stageLabels[stage]}`,
    body: outcome ? `Outcome: ${outcomeLabels[outcome as Outcome] ?? outcome}` : null,
  });

  return { ok: true as const, application: updated };
}

export async function completeNextAction(
  userId: string,
  id: string,
  nextAction: { type: ActionType; dueAt: Date; note?: string | null } | null,
) {
  const [current] = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .limit(1);
  if (!current) return { ok: false as const, error: "Application not found." };

  await db.insert(applicationEvents).values({
    userId,
    applicationId: id,
    eventType: "action_completed",
    title: current.nextActionType
      ? `Completed: ${actionLabels[current.nextActionType as ActionType] ?? current.nextActionType}`
      : "Action completed",
    body: current.nextActionNote,
  });

  await db
    .update(applications)
    .set({
      nextActionType: nextAction?.type ?? null,
      nextActionDueAt: nextAction?.dueAt ?? null,
      nextActionNote: nextAction?.note ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(applications.id, id), eq(applications.userId, userId)));

  return { ok: true as const };
}

export async function snoozeNextAction(userId: string, id: string, days = 2) {
  const due = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await db
    .update(applications)
    .set({ nextActionDueAt: due, updatedAt: new Date() })
    .where(and(eq(applications.id, id), eq(applications.userId, userId)));
  return due;
}

export async function addEvent(
  userId: string,
  applicationId: string,
  eventType: string,
  title: string,
  body?: string | null,
) {
  await db.insert(applicationEvents).values({
    userId,
    applicationId,
    eventType,
    title,
    body: body ?? null,
  });
}

export async function dueActions(userId: string, until = new Date()) {
  return db
    .select({
      id: applications.id,
      company: applications.company,
      title: applications.title,
      stage: applications.stage,
      nextActionType: applications.nextActionType,
      nextActionDueAt: applications.nextActionDueAt,
      nextActionNote: applications.nextActionNote,
    })
    .from(applications)
    .where(
      and(
        eq(applications.userId, userId),
        isNull(applications.archivedAt),
        lte(applications.nextActionDueAt, until),
      ),
    )
    .orderBy(asc(applications.nextActionDueAt));
}

export async function upcomingActions(userId: string, days = 7) {
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return db
    .select({
      id: applications.id,
      company: applications.company,
      title: applications.title,
      stage: applications.stage,
      nextActionType: applications.nextActionType,
      nextActionDueAt: applications.nextActionDueAt,
    })
    .from(applications)
    .where(
      and(
        eq(applications.userId, userId),
        isNull(applications.archivedAt),
        gte(applications.nextActionDueAt, sql`now()`),
        lte(applications.nextActionDueAt, until),
      ),
    )
    .orderBy(asc(applications.nextActionDueAt));
}

export async function upcomingInterviews(userId: string, days = 14) {
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return db
    .select({
      id: interviews.id,
      applicationId: interviews.applicationId,
      round: interviews.round,
      scheduledAt: interviews.scheduledAt,
      location: interviews.location,
      meetingUrl: interviews.meetingUrl,
      interviewerName: interviews.interviewerName,
      status: interviews.status,
      company: applications.company,
      title: applications.title,
    })
    .from(interviews)
    .leftJoin(applications, eq(interviews.applicationId, applications.id))
    .where(
      and(
        eq(interviews.userId, userId),
        gte(interviews.scheduledAt, sql`now()`),
        lte(interviews.scheduledAt, until),
      ),
    )
    .orderBy(asc(interviews.scheduledAt));
}
