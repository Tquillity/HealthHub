import { describe, expect, it } from 'vitest';
import {
  checkInvitation,
  INVITATION_TTL_DAYS,
  InvitationIdSchema,
  invitationExpiry,
  invitePath,
  isPendingInvitation,
  normalizeEmail,
} from './invitations';
import { generateInvitationId, generateRecordId } from './record-ids';

const now = new Date('2026-06-01T12:00:00Z');
const pending = {
  status: 'pending',
  expiresAt: new Date('2026-06-05T00:00:00Z'),
  email: 'partner@example.com',
};

describe('checkInvitation', () => {
  it('accepts a pending, unexpired invitation for the same email in any case', () => {
    expect(checkInvitation(pending, { email: 'Partner@Example.COM' }, now)).toBe('ok');
  });

  it('rejects someone else', () => {
    expect(checkInvitation(pending, { email: 'other@example.com' }, now)).toBe('wrong_recipient');
  });

  it('rejects used, cancelled and expired invitations', () => {
    expect(checkInvitation({ ...pending, status: 'accepted' }, { email: pending.email }, now)).toBe(
      'not_pending'
    );
    expect(checkInvitation({ ...pending, status: 'rejected' }, { email: pending.email }, now)).toBe(
      'not_pending'
    );
    expect(
      checkInvitation({ ...pending, expiresAt: new Date('2026-06-01T12:00:00Z') }, { email: pending.email }, now)
    ).toBe('expired');
    expect(checkInvitation(null, { email: pending.email }, now)).toBe('not_found');
  });

  it('checks status before revealing whether the email matches', () => {
    expect(checkInvitation({ ...pending, status: 'accepted' }, { email: 'x@example.com' }, now)).toBe(
      'not_pending'
    );
  });
});

describe('invitation helpers', () => {
  it('normalizes emails', () => {
    expect(normalizeEmail('  Partner@Example.COM ')).toBe('partner@example.com');
  });

  it('knows which invitations are pending', () => {
    expect(isPendingInvitation(pending, now)).toBe(true);
    expect(isPendingInvitation({ ...pending, status: 'accepted' }, now)).toBe(false);
    expect(isPendingInvitation({ ...pending, expiresAt: new Date('2026-05-01') }, now)).toBe(false);
  });

  it('expires after the TTL', () => {
    expect(invitationExpiry(now).getTime() - now.getTime()).toBe(
      INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000
    );
  });

  it('builds the invite path', () => {
    expect(invitePath('inv_abc-123')).toBe('/invite/inv_abc-123');
  });
});

describe('invitation ids', () => {
  it('are unguessable and URL-safe', () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateInvitationId()));
    expect(ids.size).toBe(200);
    for (const id of ids) {
      expect(id).toMatch(/^inv_[A-Za-z0-9_-]{32}$/);
      expect(InvitationIdSchema.safeParse(id).success).toBe(true);
    }
  });

  it('accept Better-Auth and older fallback ids, and nothing that could escape the path', () => {
    expect(InvitationIdSchema.safeParse('aB3dE5fG7hJ9kL1mN3pQ5rS7tU9vW1xY').success).toBe(true);
    expect(InvitationIdSchema.safeParse('inv_1700000000000_abc1234').success).toBe(true);
    expect(InvitationIdSchema.safeParse('../../etc').success).toBe(false);
    expect(InvitationIdSchema.safeParse('short').success).toBe(false);
  });

  it('record ids carry their prefix', () => {
    expect(generateRecordId('org')).toMatch(/^org_[A-Za-z0-9_-]{22}$/);
  });
});
