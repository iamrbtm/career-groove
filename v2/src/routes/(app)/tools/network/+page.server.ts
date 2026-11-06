import { redirect } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { db } from "#lib/server/db";
import { applicationContacts, applications, contacts } from "#lib/server/db/schema";

export async function load({ locals }: { locals: App.Locals }) {
  const user = locals.user!;
  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      email: contacts.email,
      phone: contacts.phone,
      company: contacts.company,
      role: contacts.role,
      notes: contacts.notes,
      updatedAt: contacts.updatedAt,
    })
    .from(contacts)
    .where(eq(contacts.userId, user.id))
    .orderBy(contacts.name);
  const linked = await db
    .select({
      contactId: applicationContacts.contactId,
      applicationId: applicationContacts.applicationId,
      relationship: applicationContacts.relationship,
      company: applications.company,
      roleTitle: applications.title,
    })
    .from(applicationContacts)
    .innerJoin(applications, eq(applicationContacts.applicationId, applications.id))
    .where(eq(applications.userId, user.id));
  return { contacts: rows, linked };
}

function value(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}
function optional(form: FormData, key: string) {
  return value(form, key) || null;
}

export const actions = {
  add: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    const name = value(form, "name");
    if (!name) return { error: "Name is required." };
    await db.insert(contacts).values({
      userId: user.id,
      name,
      email: optional(form, "email"),
      phone: optional(form, "phone"),
      company: optional(form, "company"),
      role: optional(form, "role"),
      notes: optional(form, "notes"),
    });
    redirect(303, "/tools/network");
  },

  delete: async ({ request, locals }: { request: Request; locals: App.Locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    await db.delete(contacts).where(and(eq(contacts.id, value(form, "id")), eq(contacts.userId, user.id)));
    redirect(303, "/tools/network");
  },
};