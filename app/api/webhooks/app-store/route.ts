import { z } from "zod";
import { db } from "@/lib/db";
import {
  appStoreSubscriptionState,
  isAppStoreProduct,
  verifyAppStoreNotification,
} from "@/lib/app-store";

const bodySchema = z.object({ signedPayload: z.string().min(100).max(500000) });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });
  try {
    const { notification, transaction, environment } = await verifyAppStoreNotification(parsed.data.signedPayload);
    if (!notification.notificationUUID) return Response.json({ error: "Missing notification identifier" }, { status: 400 });
    const inserted = await db.query(
      `INSERT INTO app_store_notifications(notification_id,notification_type,environment)
       VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING notification_id`,
      [notification.notificationUUID, notification.notificationType ?? null, environment],
    );
    if (!inserted.rowCount || !transaction?.originalTransactionId || !isAppStoreProduct(transaction.productId)) {
      return new Response(null, { status: 204 });
    }
    const state = appStoreSubscriptionState(transaction);
    await db.query(
      `UPDATE users SET
        "appStoreOriginalTransactionId"=$1,"appStoreProductId"=$2,
        "appStoreEnvironment"=$3,"appStoreExpiresAt"=$4,
        updated_at=now()
       WHERE "appStoreOriginalTransactionId"=$1
         OR ($5::uuid IS NOT NULL AND id=$5::uuid)`,
      [
        transaction.originalTransactionId,
        transaction.productId,
        environment,
        state.expiresAt,
        transaction.appAccountToken ?? null,
      ],
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("App Store notification verification failed", error);
    return Response.json({ error: "Invalid App Store signature" }, { status: 401 });
  }
}
