import { z } from 'zod';

/**
 * Invitation rules shared by the household actions, the household page and /invite/<id>.
 * Safe to import in client components (id generation lives in record-ids.ts).
 *
 * There is no email service yet, so an invitation is accepted in the app: the inviter copies
 * the invite link, or the invitee finds it under "Invitations for you" on the household page.
 * The link's id is the only secret, so it must be unguessable.
 */

/** How long an invitation created by HealthHub stays valid. Better-Auth's own default is 48 hours. */
export const INVITATION_TTL_DAYS = 7;

/** Better-Auth stores emails lower-case; compare and store invitation emails the same way. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Invitation ids come from Better-Auth (alphanumeric) or from us (`inv_` + base64url, or the
 * older `inv_<time>_<random>` form). Anything else is not an invitation id.
 */
export const InvitationIdSchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid invitation');

export function invitationExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function invitePath(invitationId: string): string {
  return `/invite/${encodeURIComponent(invitationId)}`;
}

export type InvitationLike = {
  status: string;
  expiresAt: Date;
  email: string;
};

export function isPendingInvitation(invitation: InvitationLike, now: Date = new Date()): boolean {
  return invitation.status === 'pending' && invitation.expiresAt.getTime() > now.getTime();
}

export type InvitationCheck =
  | 'ok'
  | 'not_found'
  | 'not_pending'
  | 'expired'
  | 'wrong_recipient';

/**
 * Can this signed-in user accept (or decline) the invitation? Only while it is pending and
 * unexpired, and only with the email address it was sent to (case-insensitive).
 */
export function checkInvitation(
  invitation: InvitationLike | null,
  user: { email: string },
  now: Date = new Date()
): InvitationCheck {
  if (!invitation) return 'not_found';
  if (invitation.status !== 'pending') return 'not_pending';
  if (invitation.expiresAt.getTime() <= now.getTime()) return 'expired';
  if (normalizeEmail(invitation.email) !== normalizeEmail(user.email)) {
    return 'wrong_recipient';
  }
  return 'ok';
}

export const INVITATION_CHECK_MESSAGES: Record<Exclude<InvitationCheck, 'ok'>, string> = {
  not_found: "We couldn't find this invitation. Ask for a new link.",
  not_pending: 'This invitation has already been used or was cancelled.',
  expired: 'This invitation has expired. Ask for a new link.',
  wrong_recipient:
    'This invitation was sent to a different email address. Sign in with that address to accept it.',
};
