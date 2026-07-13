// Password hashing with Node's built-in scrypt — no external dependency, no
// service, nothing to pay for. Each hash carries its own random salt and is
// stored as "salt:hash". Verification is constant-time.

import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, KEYLEN);
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== "string") return false;
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const derived = await scryptAsync(password, salt, KEYLEN);
  const expected = Buffer.from(hashHex, "hex");
  // timingSafeEqual throws on length mismatch — guard first.
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
