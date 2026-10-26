import test from "node:test";
import assert from "node:assert/strict";
import { encryptSecret, decryptSecret } from "@/lib/secret-box";
import {
  encryptStoredSecret,
  isCipherSecret,
  redactPremiumAiConfig,
  resolveStoredSecret,
} from "@/lib/premium-ai";

process.env.PROVIDER_ENCRYPTION_KEY ||= "test-master-key-for-premium-ai-tests";

test("isCipherSecret detects secret-box ciphertext and rejects legacy plaintext", () => {
  const encrypted = encryptSecret("sk-legacy-check");
  assert.equal(isCipherSecret(encrypted), true);
  assert.equal(isCipherSecret("sk-plaintext-key"), false);
  assert.equal(isCipherSecret(""), false);
});

test("resolveStoredSecret round-trips encrypted values and passes legacy plaintext through", () => {
  const encrypted = encryptSecret("sk-round-trip");
  assert.equal(resolveStoredSecret(encrypted), "sk-round-trip");
  assert.equal(decryptSecret(encrypted), "sk-round-trip");
  assert.equal(resolveStoredSecret("sk-legacy-plaintext"), "sk-legacy-plaintext");
  assert.equal(resolveStoredSecret(""), undefined);
  assert.equal(resolveStoredSecret(undefined), undefined);
  assert.equal(resolveStoredSecret(null), undefined);
});

test("encryptStoredSecret returns ciphertext and never double-encrypts cipher-prefixed values", () => {
  const encrypted = encryptStoredSecret("sk-fresh-key");
  assert.equal(isCipherSecret(encrypted), true);
  assert.equal(decryptSecret(encrypted), "sk-fresh-key");
  const alreadyEncrypted = encryptSecret("sk-already-cipher");
  assert.equal(encryptStoredSecret(alreadyEncrypted), alreadyEncrypted);
});

test("redactPremiumAiConfig strips api_key and exposes configured hint for ciphertext", () => {
  const encrypted = encryptSecret("sk-premium-one");
  const redacted = redactPremiumAiConfig({
    provider: "openai",
    model: "gpt-4o-mini",
    api_key: encrypted,
    base_url: null,
  });
  assert.ok(!("api_key" in redacted));
  assert.equal(redacted.provider, "openai");
  assert.equal(redacted.model, "gpt-4o-mini");
  assert.equal(redacted.base_url, null);
  assert.equal(redacted.apiKeyConfigured, true);
  assert.equal(redacted.apiKeyHint, "-one");
});

test("redactPremiumAiConfig treats legacy plaintext api_key as configured without decrypting", () => {
  const redacted = redactPremiumAiConfig({
    provider: "anthropic",
    api_key: "sk-legacy-plaintext",
  });
  assert.ok(!("api_key" in redacted));
  assert.equal(redacted.apiKeyConfigured, true);
  assert.equal(redacted.apiKeyHint, "text");
});

test("redactPremiumAiConfig reports unconfigured when api_key is empty or missing", () => {
  const empty = redactPremiumAiConfig({ provider: "openai", api_key: "" });
  assert.ok(!("api_key" in empty));
  assert.equal(empty.apiKeyConfigured, false);
  assert.equal(empty.apiKeyHint, "");
  const missing = redactPremiumAiConfig({ provider: "openai" });
  assert.equal(missing.apiKeyConfigured, false);
  assert.equal(missing.apiKeyHint, "");
});

test("redactPremiumAiConfig falls back to raw value when ciphertext cannot be decrypted with current key", () => {
  const originalKey = process.env.PROVIDER_ENCRYPTION_KEY;
  const orphaned = encryptSecret("sk-orphaned");
  process.env.PROVIDER_ENCRYPTION_KEY = originalKey === "test-master-key-for-premium-ai-tests" ? "test-other-master-key" : "test-master-key-for-premium-ai-tests";
  const redacted = redactPremiumAiConfig({ api_key: orphaned });
  assert.equal(redacted.apiKeyConfigured, true);
  assert.equal(redacted.apiKeyHint, orphaned.slice(-4));
  process.env.PROVIDER_ENCRYPTION_KEY = originalKey;
});
