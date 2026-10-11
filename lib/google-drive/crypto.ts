import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedValue = { ciphertext: string; iv: string; authTag: string; keyVersion: string };

export const GOOGLE_DRIVE_TOKEN_ENCRYPTION_ALGORITHM = "aes-256-gcm:v1";

function encryptionKey(encoded: string) {
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("A chave de criptografia do Google Drive deve ter 32 bytes em Base64.");
  return key;
}

export function encrypt(value: string, encodedKey: string, keyVersion: string): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(encodedKey), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    keyVersion,
  };
}

export function decrypt(value: EncryptedValue, encodedKey: string) {
  const iv = Buffer.from(value.iv, "base64");
  const authTag = Buffer.from(value.authTag, "base64");
  const ciphertext = Buffer.from(value.ciphertext, "base64");
  if (iv.length !== 12 || authTag.length !== 16 || ciphertext.length < 1) throw new Error("Token do Google Drive inválido.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(encodedKey), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
