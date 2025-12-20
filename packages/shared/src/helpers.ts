import crypto from "crypto";

/**
 * Converts an enum to a pgEnum values
 * @param myEnum - The enum to convert to a pgEnum
 * @returns The pgEnum values
 */
export function enumToPgEnum<T extends Record<string, string>>(
  myEnum: T,
): [T[keyof T], ...T[keyof T][]] {
  return Object.values(myEnum).map((value: string) => `${value}`) as [T[keyof T], ...T[keyof T][]];
}

/**
 * Generates a cryptographically secure random state token for OAuth CSRF protection
 * @returns A base64-encoded random state token
 */
export function generateStateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}
