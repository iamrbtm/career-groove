import { and, asc, eq } from "drizzle-orm";
import { db } from "./db";
import { credentials, jobs, profiles, residences, skills } from "./db/schema";

export async function getProfile(userId: string, fallbackName: string) {
  const [row] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  if (row) return row;
  const [created] = await db
    .insert(profiles)
    .values({ userId, name: fallbackName })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [existing] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return existing;
}

export type ProfileInput = {
  name?: string | null;
  phone?: string | null;
  linkedin?: string | null;
  github?: string | null;
  portfolio?: string | null;
  twitter?: string | null;
  website?: string | null;
  desiredTitles?: string[];
  workModes?: string[];
  salaryTarget?: number | null;
  locationPreference?: string | null;
  industries?: string[];
};

export async function updateProfile(userId: string, input: ProfileInput) {
  await db
    .insert(profiles)
    .values({
      userId,
      name: input.name ?? null,
      phone: input.phone ?? null,
      linkedin: input.linkedin ?? null,
      github: input.github ?? null,
      portfolio: input.portfolio ?? null,
      twitter: input.twitter ?? null,
      website: input.website ?? null,
      desiredTitles: input.desiredTitles ?? [],
      workModes: input.workModes ?? [],
      salaryTarget: input.salaryTarget ?? null,
      locationPreference: input.locationPreference ?? null,
      industries: input.industries ?? [],
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: profiles.userId,
      set: {
        name: input.name ?? null,
        phone: input.phone ?? null,
        linkedin: input.linkedin ?? null,
        github: input.github ?? null,
        portfolio: input.portfolio ?? null,
        twitter: input.twitter ?? null,
        website: input.website ?? null,
        desiredTitles: input.desiredTitles ?? [],
        workModes: input.workModes ?? [],
        salaryTarget: input.salaryTarget ?? null,
        locationPreference: input.locationPreference ?? null,
        industries: input.industries ?? [],
        updatedAt: new Date(),
      },
    });
}

export async function listJobs(userId: string) {
  return db
    .select()
    .from(jobs)
    .where(eq(jobs.userId, userId))
    .orderBy(asc(jobs.startedOn));
}

export async function listResidences(userId: string) {
  return db
    .select()
    .from(residences)
    .where(eq(residences.userId, userId))
    .orderBy(asc(residences.startedOn));
}

export async function listCredentials(userId: string) {
  return db
    .select()
    .from(credentials)
    .where(eq(credentials.userId, userId))
    .orderBy(asc(credentials.issuedOn));
}

export async function listSkills(userId: string) {
  return db.select().from(skills).where(eq(skills.userId, userId)).orderBy(asc(skills.name));
}

export async function deleteJob(userId: string, id: string) {
  await db.delete(jobs).where(and(eq(jobs.id, id), eq(jobs.userId, userId)));
}

export async function deleteResidence(userId: string, id: string) {
  await db.delete(residences).where(and(eq(residences.id, id), eq(residences.userId, userId)));
}

export async function deleteCredential(userId: string, id: string) {
  await db.delete(credentials).where(and(eq(credentials.id, id), eq(credentials.userId, userId)));
}

export async function deleteSkill(userId: string, id: string) {
  await db.delete(skills).where(and(eq(skills.id, id), eq(skills.userId, userId)));
}
