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

/** The start password of the demo setup. It is public (it is in the docs), so a public server never accepts it. */
export const PUBLIC_DEFAULT_PASSWORD = "lernheft";

/** Password every seeded teacher starts with; it has to be changed at the first login. */
export const INITIAL_PASSWORD = process.env.INITIAL_TEACHER_PASSWORD || PUBLIC_DEFAULT_PASSWORD;

/**
 * On the production server the public "lernheft" never logs in. Local test runs that need the
 * demo accounts set ALLOW_DEFAULT_PASSWORD=1.
 */
export function defaultPasswordBlocked() {
  return process.env.NODE_ENV === "production" && process.env.ALLOW_DEFAULT_PASSWORD !== "1";
}

/** A one-time start password for a new or reset account, shown once to the admin. No look-alike characters. */
export function randomStartPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const pick = () => Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join("");
  return `${pick()}-${pick()}-${pick()}`;
}
