import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { appSettings } from "./db/schema";
import { decryptSecret, encryptSecret, isEncrypted } from "./crypto";

const KNOWN_KEYS = [
  "ai.provider",
  "ai.model",
  "ai.apiKey",
  "ai.baseURL",
  "search.key",
  "smtp.host",
  "smtp.port",
  "smtp.user",
  "smtp.password",
  "smtp.from",
  "smtp.secure",
];

export async function listSettings() {
  const rows = await db.select().from(appSettings);
  return rows.map((row) => {
    const value = isEncrypted(row.valueEncrypted) ? decryptSecret(row.valueEncrypted) : "";
    return {
      key: row.key,
      value,
      masked: maskValue(row.key, value),
    };
  });
}

function maskValue(key: string, value: string): string {
  if (!value) return "";
  if (key.endsWith("password") || key.endsWith("apiKey") || key.endsWith("secret")) {
    return value.length <= 4 ? "••••" : `${value.slice(0, 3)}••••${value.slice(-2)}`;
  }
  return value;
}

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  if (!row) return null;
  return isEncrypted(row.valueEncrypted) ? decryptSecret(row.valueEncrypted) : row.valueEncrypted;
}

export async function setSetting(key: string, value: string | null) {
  const encrypted = value && value.trim() ? encryptSecret(value) : "";
  await db
    .insert(appSettings)
    .values({ key, valueEncrypted: encrypted, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { valueEncrypted: encrypted, updatedAt: new Date() } });
}

export async function deleteSetting(key: string) {
  await db.delete(appSettings).where(eq(appSettings.key, key));
}

export function knownKeys() {
  return KNOWN_KEYS;
}