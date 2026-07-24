import { z } from "zod";

import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

const paramsSchema = z.object({ id: z.string().uuid() });
const inputSchema = z.object({
  contactId: z.string().uuid().optional(),
  name: z.string().trim().max(160).optional(),
  company: z.string().trim().max(160).optional(),
  role: z.string().trim().max(160).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  phone: z.string().trim().max(60).optional(),
  relationship: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(3000).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsedParams = paramsSchema.safeParse(await params);
  const parsedBody = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsedParams.success || !parsedBody.success) {
    return Response.json({ error: "Invalid contact link" }, { status: 400 });
  }

  const appExists = await db.query("SELECT id FROM applications WHERE id=$1 AND user_id=$2", [parsedParams.data.id, user]);
  if (!appExists.rowCount) return Response.json({ error: "Application not found" }, { status: 404 });
  const input = parsedBody.data;

  const contactSource = input.contactId
    ? await db.query(
      `SELECT id,name,company,role,email,phone
       FROM contacts
       WHERE id=$1 AND user_id=$2`,
      [input.contactId, user],
    )
    : null;
  if (input.contactId && !contactSource?.rowCount) {
    return Response.json({ error: "Contact not found" }, { status: 404 });
  }

  const base = contactSource?.rows[0] ?? {};
  const created = await db.query(
    `INSERT INTO application_contacts(user_id,application_id,contact_id,name,company,role,email,phone,relationship,notes)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id,name,company,role,email,phone,relationship,notes,created_at AS "createdAt"`,
    [
      user,
      parsedParams.data.id,
      input.contactId ?? null,
      input.name || base.name || null,
      input.company || base.company || null,
      input.role || base.role || null,
      input.email || base.email || null,
      input.phone || base.phone || null,
      input.relationship || base.relationship || null,
      input.notes || null,
    ],
  );
  if (!input.contactId && (input.name || base.name)) {
    await db.query(
      `INSERT INTO contacts(user_id,name,company,role,email,phone,relationship_strength,notes,links)
       VALUES($1,$2,$3,$4,$5,$6,3,$7::jsonb,$8::jsonb)
       ON CONFLICT DO NOTHING`,
      [
        user,
        created.rows[0].name,
        created.rows[0].company,
        created.rows[0].role,
        created.rows[0].email,
        created.rows[0].phone,
        JSON.stringify(input.notes ? [{ text: input.notes, at: new Date().toISOString() }] : []),
        JSON.stringify({ applications: [parsedParams.data.id], relationship: created.rows[0].relationship }),
      ],
    );
  }
  await db.query(
    `INSERT INTO application_events(user_id,application_id,event_type,title,body,metadata)
     VALUES($1,$2,'contact_linked',$3,$4,$5::jsonb)`,
    [
      user,
      parsedParams.data.id,
      "Contact linked",
      created.rows[0].name ? `${created.rows[0].name} added to this opportunity.` : null,
      JSON.stringify({ contactId: input.contactId ?? null }),
    ],
  );
  return Response.json({ contact: created.rows[0] }, { status: 201 });
}
