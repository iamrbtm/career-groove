import { redirect } from "@sveltejs/kit";
import { and, desc, eq } from "drizzle-orm";
import { db } from "#lib/server/db";
import { applications, contacts, followUps } from "#lib/server/db/schema";
import { sendEmail } from "#lib/server/email";

export async function load({ locals }: { locals: App.Locals }) {
  const user = locals.user!;
  const [rows, apps, contactRows] = await Promise.all([
    db
      .select({
        id: followUps.id,
        applicationId: followUps.applicationId,
        contactId: followUps.contactId,
        dueAt: followUps.dueAt,
        status: followUps.status,
        subject: followUps.subject,
        body: followUps.body,
        sentAt: followUps.sentAt,
        company: applications.company,
        roleTitle: applications.title,
        contactName: contacts.name,
        contactEmail: contacts.email,
      })
      .from(followUps)
      .leftJoin(applications, eq(followUps.applicationId, applications.id))
      .leftJoin(contacts, eq(followUps.contactId, contacts.id))
      .where(eq(followUps.userId, user.id))
      .orderBy(desc(followUps.dueAt)),
    db
      .select({ id: applications.id, company: applications.company, title: applications.title })
      .from(applications)
      .where(eq(applications.userId, user.id)),
    db.select().from(contacts).where(eq(contacts.userId, user.id)),
  ]);
  return { followUps: rows, applications: apps, contacts: contactRows };
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
  create: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    const subject = value(form, "subject");
    if (!subject) return { error: "Subject is required." };
    const [row] = await db
      .insert(followUps)
      .values({
        userId: user.id,
        applicationId: optional(form, "applicationId"),
        contactId: optional(form, "contactId"),
        dueAt: dateOrNull(form, "dueAt"),
        status: "draft",
        subject,
        body: value(form, "body"),
      })
      .returning();
    redirect(303, `/follow-ups/${row.id}`);
  },

  send: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    const id = value(form, "id");
    const toEmail = value(form, "toEmail");
    const subject = value(form, "subject");
    const body = value(form, "body");
    if (!toEmail || !subject) return { error: "Recipient email and subject are required." };
    const result = await sendEmail({
      userId: user.id,
      applicationId: optional(form, "applicationId"),
      toEmail,
      subject,
      body,
    });
    if (!result.ok) return { error: result.error };
    await db
      .update(followUps)
      .set({ status: "sent", sentAt: new Date() })
      .where(and(eq(followUps.id, id), eq(followUps.userId, user.id)));
    redirect(303, "/follow-ups");
  },
};