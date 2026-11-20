import { randomBytes } from 'node:crypto';

/** Ids for rows HealthHub inserts itself into Better-Auth tables. Server only (node:crypto). */

/**
 * Invitation ids are the secret in an invite link (/invite/<id>), so they must be
 * unguessable: 24 random bytes (192 bits), base64url so they are safe in a URL path.
 */
export function generateInvitationId(): string {
  return `inv_${randomBytes(24).toString('base64url')}`;
}

/** Organizations and memberships: 16 random bytes, base64url. */
export function generateRecordId(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString('base64url')}`;
}
