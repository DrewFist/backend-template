import { env } from "@repo/config";
import * as jwt from "jsonwebtoken";

/**
 * Signs a JWT
 * @param payload payload to sign
 * @param options options for the sign
 * @returns the signed token
 */
export function signJwt(payload: jwt.JwtPayload, options: jwt.SignOptions) {
  return jwt.sign(payload, env.JWT_SECRET, { ...options, algorithm: "HS256" });
}

/**
 * Verifies a JWT
 * @param token token to verify
 * @param options options for the verify
 * @returns the decoded payload
 */
export function verifyJwt(token: string, options: jwt.VerifyOptions) {
  return jwt.verify(token, env.JWT_SECRET, { ...options, algorithms: ["HS256"] });
}
