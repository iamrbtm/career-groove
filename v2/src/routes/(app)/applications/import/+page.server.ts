import { redirect } from "@sveltejs/kit";
import { createApplication } from "#lib/server/applications";
import { parseJobEmail, parseJobFromText } from "#lib/server/import";

export async function load() {
  return {};
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

export const actions = {
  parse: async ({ request }: { request: Request }) => {
    const form = await request.formData();
    const text = value(form, "text");
    if (!text) return { error: "Paste a job description or URL first." };
    const parsed = await parseJobFromText(text);
    if (!parsed) return { error: "AI is not configured or could not parse the text. Use the manual form below." };
    return { parsed };
  },

  parseEmail: async ({ request }: { request: Request }) => {
    const form = await request.formData();
    const text = value(form, "text");
    if (!text) return { error: "Paste an email first." };
    const parsed = await parseJobEmail(text);
    if (!parsed) return { error: "AI is not configured or could not parse the email. Use the manual form below." };
    return { parsed: parsed };
  },

  create: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    const company = value(form, "company");
    const title = value(form, "title");
    if (!company || !title) return { error: "Company and role title are required." };
    const app = await createApplication(user.id, {
      company,
      title,
      location: optional(form, "location"),
      workMode: optional(form, "workMode"),
      salaryMin: numberOrNull(form, "salaryMin"),
      salaryMax: numberOrNull(form, "salaryMax"),
      sourceUrl: optional(form, "sourceUrl"),
      jobDescription: optional(form, "jobDescription"),
    });
    redirect(303, `/applications/${app.id}`);
  },
};