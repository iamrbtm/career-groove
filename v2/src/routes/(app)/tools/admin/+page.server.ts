import { redirect } from "@sveltejs/kit";
import { knownKeys, listSettings, setSetting } from "#lib/server/settings";
import { testConnection } from "#lib/server/ai";
import { sendEmail } from "#lib/server/email";

export async function load({ locals }: { locals: App.Locals }) {
  const user = locals.user!;
  if (!user.isAdmin) redirect(303, "/home");
  const settings = await listSettings();
  return { settings, keys: knownKeys() };
}

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export const actions = {
  save: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    if (!locals.user?.isAdmin) redirect(303, "/home");
    const form = await request.formData();
    for (const key of knownKeys()) {
      await setSetting(key, value(form, key) || null);
    }
    redirect(303, "/tools/admin?saved=1");
  },

  testAi: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    if (!locals.user?.isAdmin) redirect(303, "/home");
    const result = await testConnection();
    return { aiTest: result };
  },

  testSmtp: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    if (!locals.user?.isAdmin) redirect(303, "/home");
    const form = await request.formData();
    const to = value(form, "testEmail");
    if (!to) return { smtpTest: { ok: false, error: "Enter a test email address." } };
    const result = await sendEmail({
      userId: locals.user!.id,
      toEmail: to,
      subject: "CareerGroove test email",
      body: "This is a test email from CareerGroove v2.",
    });
    return { smtpTest: result };
  },
};