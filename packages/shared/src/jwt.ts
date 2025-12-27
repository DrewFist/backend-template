import * as jwt from "jsonwebtoken";

/**
 * Signs a JWT
 * @param payload payload to sign
 * @param jwtSecret JWT secret key
 * @param options options for the sign
 * @returns the signed token
 */
export function signJwt(payload: jwt.JwtPayload, jwtSecret: string, options: jwt.SignOptions) {
  return jwt.sign(payload, jwtSecret, { ...options, algorithm: "HS256" });
}

/**
 * Verifies a JWT
 * @param token token to verify
 * @param jwtSecret JWT secret key
 * @param options options for the verify
 * @returns the decoded payload
 */
export function verifyJwt(token: string, jwtSecret: string, options: jwt.VerifyOptions) {
  return jwt.verify(token, jwtSecret, { ...options, algorithms: ["HS256"] });
}
