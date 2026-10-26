import { z } from "zod";
import { db, withTransaction } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { encryptSecret } from "@/lib/secret-box";

const createSchema = z.object({
  provider: z.enum(["gmail", "icloud", "yahoo", "outlook", "smtp"]),
  email: z.string().email(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().int().optional(),
  smtpUsername: z.string().optional(),
  smtpPassword: z.string().optional(),
  senderName: z.string().max(100).optional(),
});

const idSchema = z.string().uuid();

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

  try {
    const encAccessToken = input.accessToken ? encryptSecret(input.accessToken) : null;
    const encRefreshToken = input.refreshToken ? encryptSecret(input.refreshToken) : null;
    const encSmtpPassword = input.smtpPassword ? encryptSecret(input.smtpPassword) : null;

    const result = await withTransaction(async (client) => {
      const upsert = await client.query(
        `INSERT INTO email_connections
          (user_id, provider, email, encrypted_access_token, encrypted_refresh_token,
           smtp_host, smtp_port, smtp_username, encrypted_smtp_password, sender_name, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
         ON CONFLICT (user_id, provider) DO UPDATE SET
           email = EXCLUDED.email,
           encrypted_access_token = COALESCE($4, email_connections.encrypted_access_token),
           encrypted_refresh_token = COALESCE($5, email_connections.encrypted_refresh_token),
           smtp_host = $6,
           smtp_port = $7,
           smtp_username = $8,
           encrypted_smtp_password = COALESCE($9, email_connections.encrypted_smtp_password),
           sender_name = $10,
           active = true,
           updated_at = now()
         RETURNING id, provider, email, sender_name AS "senderName", active, (xmax = 0) AS inserted`,
        [
          user, input.provider, input.email,
          encAccessToken, encRefreshToken,
          input.smtpHost || null, input.smtpPort || null,
          input.smtpUsername || null, encSmtpPassword,
          input.senderName || null,
        ],
      );

      const row = upsert.rows[0];

      await client.query(
        `UPDATE email_connections SET active=false WHERE user_id=$1 AND provider=$2 AND id<>$3`,
        [user, input.provider, row.id],
      );

      return row;
    });

    const { inserted, ...connection } = result;
    return Response.json({ connection }, { status: inserted ? 201 : 200 });
  } catch {
    return Response.json({ error: "Connection could not be saved." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Connection id required." }, { status: 400 });
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return Response.json({ error: "Invalid connection id." }, { status: 400 });

  const result = await db.query(
    "DELETE FROM email_connections WHERE id=$1 AND user_id=$2 RETURNING id",
    [parsedId.data, user],
  );
  if (!result.rowCount) return Response.json({ error: "Not found." }, { status: 404 });
  return new Response(null, { status: 204 });
}
