import { fail, redirect } from "@sveltejs/kit";
import {
  createApplication,
  getStageCounts,
  isStage,
  listApplications,
  type Stage,
} from "#lib/server/applications";

export async function load({ locals, url }: { locals: App.Locals; url: URL }) {
  const user = locals.user!;
  const stageParam = url.searchParams.get("stage");
  const stage = isStage(stageParam) ? stageParam : undefined;
  const q = url.searchParams.get("q") ?? "";
  const due = url.searchParams.get("due") === "1";
  const view = url.searchParams.get("view") === "list" ? "list" : "board";
  const [apps, counts] = await Promise.all([
    listApplications(user.id, { stage, search: q, due }),
    getStageCounts(user.id),
  ]);
  return {
    apps,
    counts,
    stage: stage ?? null,
    q,
    due,
    view,
    newLead: url.searchParams.get("new") === "1",
  };
}

export const actions = {
  create: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    const company = String(form.get("company") ?? "").trim();
    const title = String(form.get("title") ?? "").trim();
    if (!company || !title) {
      return fail(400, { error: "Company and role title are required." });
    }
    const stageValue = String(form.get("stage") ?? "lead");
    const stage: Stage = isStage(stageValue) ? stageValue : "lead";
    const salaryMin = Number(form.get("salaryMin") ?? "") || null;
    const salaryMax = Number(form.get("salaryMax") ?? "") || null;
    const app = await createApplication(user.id, {
      company,
      title,
      location: String(form.get("location") ?? "").trim() || null,
      workMode: String(form.get("workMode") ?? "").trim() || null,
      sourceUrl: String(form.get("sourceUrl") ?? "").trim() || null,
      jobDescription: String(form.get("jobDescription") ?? "").trim() || null,
      salaryMin,
      salaryMax,
      stage,
    });
    redirect(303, `/applications/${app.id}`);
  },
};
