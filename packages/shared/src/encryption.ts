import crypto from "crypto";

const algorithm = "aes-256-gcm";

/**
 * Encrypts the data using the AES-256-GCM algorithm with a random key and iv
 * @param data - The data to encrypt
 * @param encryptionKey - The 64-character hex encryption key
 * @returns The encrypted data, iv, and tag
 */
export function encrypt(data: string, encryptionKey: string) {
  const key = Buffer.from(encryptionKey, "hex");
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(data, "utf8", "base64");
  encrypted += cipher.final("base64");

  const tag = cipher.getAuthTag();

  return {
    data: encrypted,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

/**
 * Decrypts the data using the AES-256-GCM algorithm with the key, iv, and tag
 * @param data - The data to decrypt
 * @param iv - The iv used to encrypt the data
 * @param tag - The tag used to encrypt the data
 * @param encryptionKey - The 64-character hex encryption key
 * @returns The decrypted data
 */
export function decrypt(data: string, iv: string, tag: string, encryptionKey: string) {
  const key = Buffer.from(encryptionKey, "hex");
  const ivBuffer = Buffer.from(iv, "base64");
  const tagBuffer = Buffer.from(tag, "base64");

  const decipher = crypto.createDecipheriv(algorithm, key, ivBuffer);
  decipher.setAuthTag(tagBuffer);
  let decrypted = decipher.update(data, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
