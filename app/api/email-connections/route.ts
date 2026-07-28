import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";

const createSchema = z.object({
  provider: z.enum(["gmail", "outlook", "smtp"]),
  email: z.string().email(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().optional(),
  smtpUsername: z.string().optional(),
  smtpPassword: z.string().optional(),
  senderName: z.string().max(100).optional(),
});

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();
  const result = await db.query(
    `SELECT id, provider, email, sender_name AS "senderName", active, last_sync_at AS "lastSyncAt"
     FROM email_connections WHERE user_id=$1 ORDER BY active DESC, created_at DESC`,
    [user],
  );
  return Response.json({ connections: result.rows });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const input = parsed.data;
  const existing = await db.query(
    "SELECT id FROM email_connections WHERE user_id=$1 AND provider=$2",
    [user, input.provider],
  );
  if (existing.rowCount) {
    await db.query(
      `UPDATE email_connections SET email=$3, encrypted_access_token=$4, encrypted_refresh_token=$5,
       smtp_host=$6, smtp_port=$7, smtp_username=$8, encrypted_smtp_password=$9, sender_name=$10,
       active=true, updated_at=now()
       WHERE id=$1 AND user_id=$2`,
      [
        existing.rows[0].id, user, input.email,
        input.accessToken || null, input.refreshToken || null,
        input.smtpHost || null, input.smtpPort || null,
        input.smtpUsername || null, input.smtpPassword || null,
        input.senderName || null,
      ],
    );
    const result = await db.query(
      `SELECT id, provider, email, sender_name AS "senderName", active
       FROM email_connections WHERE id=$1`,
      [existing.rows[0].id],
    );
    return Response.json({ connection: result.rows[0] });
  }

  await db.query(
    `UPDATE email_connections SET active=false WHERE user_id=$1`,
    [user],
  );

  const result = await db.query(
    `INSERT INTO email_connections(user_id,provider,email,encrypted_access_token,encrypted_refresh_token,
      smtp_host,smtp_port,smtp_username,encrypted_smtp_password,sender_name,active)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
     RETURNING id, provider, email, sender_name AS "senderName", active`,
    [
      user, input.provider, input.email,
      input.accessToken || null, input.refreshToken || null,
      input.smtpHost || null, input.smtpPort || null,
      input.smtpUsername || null, input.smtpPassword || null,
      input.senderName || null,
    ],
  );
  return Response.json({ connection: result.rows[0] }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Connection id required." }, { status: 400 });

  const result = await db.query(
    "DELETE FROM email_connections WHERE id=$1 AND user_id=$2 RETURNING id",
    [id, user],
  );
  if (!result.rowCount) return Response.json({ error: "Not found." }, { status: 404 });
  return new Response(null, { status: 204 });
}
