import {
  Environment,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload,
} from "@apple/app-store-server-library";

const bundleId = "com.careergroove.careergroove";
const products = new Set([
  "com.careergroove.careergroove.pro.monthly",
  "com.careergroove.careergroove.pro.yearly",
]);

function rootCertificates() {
  const raw = process.env.APP_STORE_ROOT_CA_BASE64;
  if (!raw) throw new Error("APP_STORE_ROOT_CA_BASE64 is not configured.");
  const values = JSON.parse(raw);
  if (!Array.isArray(values) || !values.every((value) => typeof value === "string")) {
    throw new Error("APP_STORE_ROOT_CA_BASE64 must be a JSON array.");
  }
  return values.map((value) => Buffer.from(value, "base64"));
}

export function isAppStoreProduct(value?: string) {
  return Boolean(value && products.has(value));
}

export async function verifyAppStoreTransaction(signedTransaction: string) {
  const roots = rootCertificates();
  const attempts: Array<[Environment, number | undefined]> = [
    [Environment.SANDBOX, undefined],
    [Environment.PRODUCTION, process.env.APP_STORE_APP_APPLE_ID ? Number(process.env.APP_STORE_APP_APPLE_ID) : undefined],
  ];
  let lastError: unknown;
  for (const [environment, appAppleId] of attempts) {
    if (environment === Environment.PRODUCTION && !appAppleId) continue;
    try {
      const verifier = new SignedDataVerifier(roots, true, environment, bundleId, appAppleId);
      const transaction = await verifier.verifyAndDecodeTransaction(signedTransaction);
      return { transaction, environment };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("The App Store transaction could not be verified.");
}

export async function verifyAppStoreNotification(signedPayload: string) {
  const roots = rootCertificates();
  const attempts: Array<[Environment, number | undefined]> = [
    [Environment.SANDBOX, undefined],
    [Environment.PRODUCTION, process.env.APP_STORE_APP_APPLE_ID ? Number(process.env.APP_STORE_APP_APPLE_ID) : undefined],
  ];
  let lastError: unknown;
  for (const [environment, appAppleId] of attempts) {
    if (environment === Environment.PRODUCTION && !appAppleId) continue;
    try {
      const verifier = new SignedDataVerifier(roots, true, environment, bundleId, appAppleId);
      const notification = await verifier.verifyAndDecodeNotification(signedPayload);
      const transaction = notification.data?.signedTransactionInfo
        ? await verifier.verifyAndDecodeTransaction(notification.data.signedTransactionInfo)
        : null;
      return { notification, transaction, environment };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error("The App Store notification could not be verified.");
}

export function appStoreSubscriptionState(transaction: JWSTransactionDecodedPayload) {
  const expiresAt = transaction.expiresDate ? new Date(transaction.expiresDate) : null;
  const active = Boolean(
    isAppStoreProduct(transaction.productId)
      && expiresAt
      && expiresAt > new Date()
      && !transaction.revocationDate,
  );
  return {
    active,
    status: transaction.revocationDate ? "revoked" : active ? "active" : "expired",
    expiresAt,
  };
}
