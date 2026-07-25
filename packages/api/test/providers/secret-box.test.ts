import { describe, expect, it } from "vitest";

import { SecretBox } from "../../src/domains/providers/secret-box.js";

describe("SecretBox", () => {
  it("round-trips secrets with randomized authenticated encryption", () => {
    const box = new SecretBox("provider-encryption-key-at-least-32-characters");
    const first = box.encrypt("sk-secret");
    const second = box.encrypt("sk-secret");

    expect(first).not.toBe(second);
    expect(box.decrypt(first)).toBe("sk-secret");
    expect(box.decrypt(second)).toBe("sk-secret");
  });

  it("rejects modified ciphertext", () => {
    const box = new SecretBox("provider-encryption-key-at-least-32-characters");
    const encrypted = box.encrypt("sk-secret");
    const modified = `${encrypted.slice(0, -1)}x`;

    expect(() => box.decrypt(modified)).toThrow();
  });
});
