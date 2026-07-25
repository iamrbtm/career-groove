import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const algorithm = "aes-256-gcm";

export class SecretBox {
  readonly #key: Buffer;

  constructor(secret: string) {
    if (secret.length < 32) {
      throw new Error("Provider encryption key must contain at least 32 characters");
    }
    this.#key = createHash("sha256").update(secret, "utf8").digest();
  }

  encrypt(plaintext: string): string {
    const initializationVector = randomBytes(12);
    const cipher = createCipheriv(algorithm, this.#key, initializationVector);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    return [
      "v1",
      initializationVector.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  }

  decrypt(value: string): string {
    const [version, ivValue, tagValue, ciphertextValue, extra] = value.split(".");
    if (
      version !== "v1" ||
      !ivValue ||
      !tagValue ||
      !ciphertextValue ||
      extra
    ) {
      throw new Error("Invalid encrypted provider secret");
    }
    const initializationVector = Buffer.from(ivValue, "base64url");
    const tag = Buffer.from(tagValue, "base64url");
    if (initializationVector.length !== 12 || tag.length !== 16) {
      throw new Error("Invalid encrypted provider secret");
    }
    const decipher = createDecipheriv(
      algorithm,
      this.#key,
      initializationVector,
    );
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }
}
