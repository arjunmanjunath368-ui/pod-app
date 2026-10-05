import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "crypto";

// WHOOP's API terms require WHOOP data to be encrypted at rest, and a leaked
// refresh token is a standing key to someone's health account. Tokens are
// therefore encrypted (AES-256-GCM, authenticated) before they touch the
// database. The key is derived from the app's WHOOP client secret, so there's
// no extra secret to manage — the trade-off is that rotating the client
// secret makes stored tokens unreadable and members must reconnect.

const SALT = "pod-whoop-token-v1";
const keyCache: Record<string, Buffer> = {};

function keyFor(secret: string): Buffer {
  if (!keyCache[secret]) keyCache[secret] = scryptSync(secret, SALT, 32);
  return keyCache[secret];
}

// Output layout (base64): 12-byte IV | 16-byte auth tag | ciphertext
export function encryptJson(value: unknown, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(secret), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
}

// Throws if the blob was tampered with or the key is wrong.
export function decryptJson<T>(blob: string, secret: string): T {
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const body = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", keyFor(secret), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(body), decipher.final()]);
  return JSON.parse(plain.toString("utf8")) as T;
}

// A short, non-reversible fingerprint of a refresh token. Ciphertext differs on
// every encryption (random IV), so this is what lets us ask the database
// "is the stored refresh token still the one I started with?" without
// decrypting — the guard against two requests refreshing at once.
export function fingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 24);
}
