import { decryptSecret, encryptSecret } from "@/lib/secret-box";

const CIPHER_PREFIX = "v1.";

export function isCipherSecret(value: string) {
  return value.startsWith(CIPHER_PREFIX);
}

export function encryptStoredSecret(value: string) {
  if (isCipherSecret(value)) return value;
  return encryptSecret(value);
}

export function resolveStoredSecret(value: string | null | undefined) {
  if (!value) return undefined;
  if (!isCipherSecret(value)) return value;
  try {
    return decryptSecret(value);
  } catch {
    return value;
  }
}

export function redactPremiumAiConfig(config: Record<string, unknown>): Record<string, unknown> {
  const { api_key, ...rest } = config;
  const raw = typeof api_key === "string" ? api_key : "";
  const resolved = resolveStoredSecret(raw) ?? "";
  return {
    ...rest,
    apiKeyConfigured: Boolean(resolved),
    apiKeyHint: resolved.slice(-4),
  };
}
