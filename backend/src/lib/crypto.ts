import { createHash, randomBytes } from 'node:crypto';

/** URL-safe random token (email verification, password reset, refresh tokens). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 hash used to store refresh/reset tokens without keeping plaintext. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
