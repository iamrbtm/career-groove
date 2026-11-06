import { createCipheriv, createDecipheriv, scryptSync, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function key(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET || "careergroove-v2-dev-key";
  return scryptSync(secret, "careergroove-v2", 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(payload: string): string {
  const [ivPart, tagPart, dataPart] = payload.split(".");
  if (!ivPart || !tagPart || !dataPart) throw new Error("Invalid encrypted value");
  const decipher = createDecipheriv(ALGORITHM, key(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function isEncrypted(payload: string | null | undefined): boolean {
  return Boolean(payload && payload.split(".").length === 3);
}
