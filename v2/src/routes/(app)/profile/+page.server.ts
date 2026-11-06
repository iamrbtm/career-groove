import { fail, redirect } from "@sveltejs/kit";
import { db } from "#lib/server/db";
import { credentials, jobs, residences, skills } from "#lib/server/db/schema";
import {
  deleteCredential,
  deleteJob,
  deleteResidence,
  deleteSkill,
  getProfile,
  listCredentials,
  listJobs,
  listResidences,
  listSkills,
  updateProfile,
} from "#lib/server/profile";

export async function load({ locals }: { locals: App.Locals }) {
  const user = locals.user!;
  const [profile, jobRows, residenceRows, credentialRows, skillRows] = await Promise.all([
    getProfile(user.id, user.name),
    listJobs(user.id),
    listResidences(user.id),
    listCredentials(user.id),
    listSkills(user.id),
  ]);
  return {
    profile,
    jobs: jobRows,
    residences: residenceRows,
    credentials: credentialRows,
    skills: skillRows,
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
function list(form: FormData, key: string) {
  return value(form, key)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const actions = {
  updateProfile: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    await updateProfile(user.id, {
      name: optional(form, "name"),
      phone: optional(form, "phone"),
      linkedin: optional(form, "linkedin"),
      github: optional(form, "github"),
      portfolio: optional(form, "portfolio"),
      twitter: optional(form, "twitter"),
      website: optional(form, "website"),
      desiredTitles: list(form, "desiredTitles"),
      workModes: list(form, "workModes"),
      salaryTarget: numberOrNull(form, "salaryTarget"),
      locationPreference: optional(form, "locationPreference"),
      industries: list(form, "industries"),
    });
    redirect(303, "/profile");
  },

  addJob: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    const company = value(form, "company");
    const title = value(form, "title");
    if (!company || !title) return fail(400, { error: "Company and title are required." });
    await db.insert(jobs).values({
      userId: user.id,
      company,
      title,
      location: optional(form, "location"),
      startedOn: optional(form, "startedOn"),
      endedOn: optional(form, "endedOn"),
      current: value(form, "current") === "on",
      description: optional(form, "description"),
      highlights: value(form, "highlights")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    });
    redirect(303, "/profile");
  },

  addResidence: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    await db.insert(residences).values({
      userId: user.id,
      label: optional(form, "label"),
      street: optional(form, "street"),
      city: optional(form, "city"),
      region: optional(form, "region"),
      country: optional(form, "country"),
      postalCode: optional(form, "postalCode"),
      startedOn: optional(form, "startedOn"),
      endedOn: optional(form, "endedOn"),
      notes: optional(form, "notes"),
    });
    redirect(303, "/profile");
  },

  addCredential: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    const name = value(form, "name");
    if (!name) return fail(400, { error: "Credential name is required." });
    await db.insert(credentials).values({
      userId: user.id,
      kind: value(form, "kind") || "education",
      name,
      issuer: optional(form, "issuer"),
      issuedOn: optional(form, "issuedOn"),
      expiresOn: optional(form, "expiresOn"),
      url: optional(form, "url"),
      notes: optional(form, "notes"),
    });
    redirect(303, "/profile");
  },

  addSkill: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    const name = value(form, "name");
    if (!name) return fail(400, { error: "Skill name is required." });
    await db.insert(skills).values({
      userId: user.id,
      name,
      category: value(form, "category") || "other",
      proficiency: numberOrNull(form, "proficiency") ?? 3,
      notes: optional(form, "notes"),
    });
    redirect(303, "/profile");
  },

  deleteJob: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    await deleteJob(user.id, value(form, "id"));
    redirect(303, "/profile");
  },

  deleteResidence: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    await deleteResidence(user.id, value(form, "id"));
    redirect(303, "/profile");
  },

  deleteCredential: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    await deleteCredential(user.id, value(form, "id"));
    redirect(303, "/profile");
  },

  deleteSkill: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    await deleteSkill(user.id, value(form, "id"));
    redirect(303, "/profile");
  },
};
