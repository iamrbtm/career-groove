import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import { followUpTypes } from "@/lib/follow-up";

const followUpSelect = `
  SELECT id, application_id AS "applicationId", sequence_number AS "sequenceNumber",
    follow_up_type AS "followUpType", subject, message, status,
    scheduled_for AS "scheduledFor", sent_at AS "sentAt",
    delivery_method AS "deliveryMethod", ai_generated AS "aiGenerated",
    opened_at AS "openedAt", replied_at AS "repliedAt", notes,
    metadata, created_at AS "createdAt", updated_at AS "updatedAt"
  FROM application_follow_ups
`;

const createSchema = z.object({
  applicationId: z.string().uuid(),
  sequenceNumber: z.number().int().min(1).default(1),
  followUpType: z.enum(followUpTypes),
  subject: z.string().max(200).optional(),
  message: z.string().max(10000).optional(),
  scheduledFor: z.string().datetime().optional(),
  deliveryMethod: z.enum(["in_app", "email", "both"]).default("in_app"),
});

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const url = new URL(request.url);
  const applicationId = url.searchParams.get("applicationId");
  const status = url.searchParams.get("status");

  const conditions = ["user_id=$1"];
  const values: unknown[] = [user];
  if (applicationId) { conditions.push("application_id=$2"); values.push(applicationId); }
  if (status) { conditions.push("status=$" + (values.length + 1)); values.push(status); }

  const result = await db.query(
    `${followUpSelect} WHERE ${conditions.join(" AND ")} ORDER BY sequence_number, scheduled_for NULLS LAST`,
    values,
  );
  return Response.json({ followUps: result.rows });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return unauthorized();
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });

  const input = parsed.data;
  const appCheck = await db.query("SELECT id FROM applications WHERE id=$1 AND user_id=$2", [input.applicationId, user]);
  if (!appCheck.rowCount) return Response.json({ error: "Application not found." }, { status: 404 });

  const result = await db.query(
    `INSERT INTO application_follow_ups(user_id,application_id,sequence_number,follow_up_type,subject,message,scheduled_for,delivery_method)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id,application_id AS "applicationId",sequence_number AS "sequenceNumber",
      follow_up_type AS "followUpType",subject,message,status,scheduled_for AS "scheduledFor",
      delivery_method AS "deliveryMethod",ai_generated AS "aiGenerated",created_at AS "createdAt"`,
    [user, input.applicationId, input.sequenceNumber, input.followUpType, input.subject || null, input.message || null, input.scheduledFor || null, input.deliveryMethod],
  );

  await db.query(
    `UPDATE applications SET follow_up_due_at=$1,updated_at=now() WHERE id=$2 AND user_id=$3`,
    [input.scheduledFor || null, input.applicationId, user],
  );

  return Response.json({ followUp: result.rows[0] }, { status: 201 });
}
