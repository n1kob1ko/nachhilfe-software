import crypto from "node:crypto";

/** scrypt with a random salt, stored as "scrypt$<salt>$<hash>". */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.scryptSync(password, salt, 32).toString("base64url");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  const [scheme, salt, hash] = (stored ?? "").split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

/** Password every seeded teacher starts with; it has to be changed at the first login. */
export const INITIAL_PASSWORD = process.env.INITIAL_TEACHER_PASSWORD || "lernheft";
