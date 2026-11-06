import { and, asc, eq } from "drizzle-orm";
import { db } from "./db";
import { applications, interviews } from "./db/schema";

export async function listInterviews(userId: string) {
  return db
    .select({
      id: interviews.id,
      applicationId: interviews.applicationId,
      round: interviews.round,
      scheduledAt: interviews.scheduledAt,
      location: interviews.location,
      meetingUrl: interviews.meetingUrl,
      interviewerName: interviews.interviewerName,
      interviewerEmail: interviews.interviewerEmail,
      status: interviews.status,
      company: applications.company,
      title: applications.title,
    })
    .from(interviews)
    .leftJoin(applications, eq(interviews.applicationId, applications.id))
    .where(eq(interviews.userId, userId))
    .orderBy(asc(interviews.scheduledAt));
}

export async function getInterview(userId: string, id: string) {
  const [row] = await db
    .select({
      interview: interviews,
      application: applications,
    })
    .from(interviews)
    .leftJoin(applications, eq(interviews.applicationId, applications.id))
    .where(and(eq(interviews.id, id), eq(interviews.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createInterview(
  userId: string,
  input: {
    applicationId?: string | null;
    round?: string;
    scheduledAt?: Date | null;
    location?: string | null;
    meetingUrl?: string | null;
    interviewerName?: string | null;
    interviewerEmail?: string | null;
    prepNotes?: string | null;
  },
) {
  const [row] = await db
    .insert(interviews)
    .values({
      userId,
      applicationId: input.applicationId ?? null,
      round: input.round ?? "screen",
      scheduledAt: input.scheduledAt ?? null,
      location: input.location ?? null,
      meetingUrl: input.meetingUrl ?? null,
      interviewerName: input.interviewerName ?? null,
      interviewerEmail: input.interviewerEmail ?? null,
      prepNotes: input.prepNotes ?? null,
    })
    .returning();
  return row;
}

export async function updateInterview(
  userId: string,
  id: string,
  input: {
    round?: string;
    scheduledAt?: Date | null;
    location?: string | null;
    meetingUrl?: string | null;
    interviewerName?: string | null;
    interviewerEmail?: string | null;
    prepNotes?: string | null;
    status?: string;
  },
) {
  const [row] = await db
    .update(interviews)
    .set({
      round: input.round,
      scheduledAt: input.scheduledAt,
      location: input.location,
      meetingUrl: input.meetingUrl,
      interviewerName: input.interviewerName,
      interviewerEmail: input.interviewerEmail,
      prepNotes: input.prepNotes,
      status: input.status,
      updatedAt: new Date(),
    })
    .where(and(eq(interviews.id, id), eq(interviews.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteInterview(userId: string, id: string) {
  await db.delete(interviews).where(and(eq(interviews.id, id), eq(interviews.userId, userId)));
}

export function mockQuestions(round: string): string[] {
  const common = [
    "Tell me about yourself and why this role.",
    "Walk me through a project you are proud of.",
    "Describe a time you disagreed with a teammate. How did you handle it?",
    "What is the hardest technical or functional problem you have solved?",
    "Why are you leaving your current role, and why us?",
  ];
  if (round === "technical") {
    return [
      "Walk me through your approach to a problem you have not seen before.",
      "How do you decide between shipping fast and building it right?",
      "Tell me about a production issue you owned end to end.",
      "How do you test and validate your work?",
      "What would you improve about our product?",
    ];
  }
  if (round === "hiring_manager" || round === "final") {
    return [
      ...common,
      "What does success look like in your first 90 days?",
      "How do you prioritize when everything is urgent?",
      "Tell me about a time you influenced a decision without authority.",
    ];
  }
  return common;
}
