import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, unauthorized } from "@/lib/api-auth";
import {
  appStoreSubscriptionState,
  isAppStoreProduct,
  verifyAppStoreTransaction,
} from "@/lib/app-store";

const inputSchema = z.object({ signedTransaction: z.string().min(100).max(100000) });

export async function POST(request: Request) {
  const userId = await requireUser();
  if (!userId) return unauthorized();
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid StoreKit transaction" }, { status: 400 });

  try {
    const { transaction, environment } = await verifyAppStoreTransaction(parsed.data.signedTransaction);
    if (!transaction.originalTransactionId || !transaction.transactionId
      || !transaction.appAccountToken || transaction.appAccountToken.toLowerCase() !== userId.toLowerCase()
      || !isAppStoreProduct(transaction.productId)) {
      return Response.json({ error: "This purchase does not belong to this account." }, { status: 403 });
    }
    const state = appStoreSubscriptionState(transaction);
    await db.query(
      `UPDATE users SET
        "appStoreOriginalTransactionId"=$2,"appStoreProductId"=$3,
        "appStoreEnvironment"=$4,"appStoreExpiresAt"=$5,
        updated_at=now()
       WHERE id=$1`,
      [
        userId,
        transaction.originalTransactionId,
        transaction.productId,
        environment,
        state.expiresAt,
      ],
    );
    return Response.json({
      productId: transaction.productId,
      status: state.status,
      expiresAt: state.expiresAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("StoreKit transaction verification failed", error);
    return Response.json({ error: "The App Store purchase could not be verified." }, { status: 400 });
  }
}
