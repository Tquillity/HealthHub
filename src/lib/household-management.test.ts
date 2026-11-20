import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = Boolean(
  url &&
  ['localhost', '127.0.0.1'].includes(url.hostname) &&
  url.pathname === '/healthhub_e2e'
);

// The active organization cookie, as the browser would send it.
const cookieJar = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'hh_active_org' && cookieJar.value ? { name, value: cookieJar.value } : undefined,
    set: () => undefined,
    delete: () => undefined,
  }),
}));

describe.skipIf(!isolated)('household management against isolated PostgreSQL', () => {
  const run = randomUUID().slice(0, 8);
  const user = (key: string, email = `${key}-${run}@example.com`) => ({
    id: `hm-${key}-${run}`,
    email,
    name: `${key[0].toUpperCase()}${key.slice(1)} ${run}`,
  });
  const owner = user('owner');
  const admin = user('admin');
  const viewer = user('viewer');
  // Stored lower-case (as Better-Auth does); invited with different casing below.
  const partner = user('partner');
  const outsider = user('outsider');
  const loner = user('loner');
  const home = `hm-home-${run}`;
  const ownerSpare = `hm-owner-spare-${run}`;
  const partnerPersonal = `hm-partner-personal-${run}`;
  const otherOrg = `hm-other-${run}`;
  const allUsers = [owner, admin, viewer, partner, outsider, loner];
  const allOrgs = [home, ownerSpare, partnerPersonal, otherOrg];

  let pool: Pool;
  let client: PrismaClient;
  let lib: typeof import('./household-management');
  let active: typeof import('./active-organization');

  const as = (organizationId: string | undefined) => {
    cookieJar.value = organizationId;
  };
  const memberRole = async (userId: string, organizationId: string) =>
    (await client.member.findFirst({ where: { userId, organizationId } }))?.role ?? null;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    lib = await import('./household-management');
    active = await import('./active-organization');

    for (const u of allUsers) await client.user.create({ data: u });
    await client.organization.createMany({
      data: [
        { id: home, name: 'Our home', slug: home },
        { id: ownerSpare, name: 'Summer house', slug: ownerSpare },
        { id: partnerPersonal, name: 'Partner home', slug: partnerPersonal },
        { id: otherOrg, name: 'Other club', slug: otherOrg, type: 'COMMUNITY' },
      ],
    });
    const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 0, minutes));
    await client.member.createMany({
      data: [
        { id: `hm-m-owner-${run}`, organizationId: home, userId: owner.id, role: 'owner', createdAt: at(1) },
        { id: `hm-m-owner2-${run}`, organizationId: ownerSpare, userId: owner.id, role: 'owner', createdAt: at(2) },
        { id: `hm-m-admin-${run}`, organizationId: home, userId: admin.id, role: 'admin', createdAt: at(3) },
        { id: `hm-m-viewer-${run}`, organizationId: home, userId: viewer.id, role: 'viewer', createdAt: at(4) },
        { id: `hm-m-partner-${run}`, organizationId: partnerPersonal, userId: partner.id, role: 'owner', createdAt: at(5) },
        { id: `hm-m-outsider-${run}`, organizationId: otherOrg, userId: outsider.id, role: 'owner', createdAt: at(6) },
      ],
    });
  });

  beforeEach(() => as(undefined));

  afterAll(async () => {
    await client.invitation.deleteMany({ where: { organizationId: { in: allOrgs } } });
    await client.organization.deleteMany({ where: { id: { in: allOrgs } } });
    await client.organization.deleteMany({ where: { members: { none: {} }, id: { startsWith: 'household-hm-' } } });
    await client.organization.deleteMany({ where: { id: `household-${loner.id}` } });
    await client.user.deleteMany({ where: { id: { in: allUsers.map((u) => u.id) } } });
    await client.$disconnect();
    await pool.end();
  });

  describe('active organization', () => {
    it('uses the cookie only when the user is a member, else the oldest membership', async () => {
      expect((await active.resolveActiveMembership(owner.id, ownerSpare))?.organizationId).toBe(ownerSpare);
      expect((await active.resolveActiveMembership(owner.id, otherOrg))?.organizationId).toBe(home);
      expect((await active.resolveActiveMembership(owner.id, null))?.organizationId).toBe(home);

      as(otherOrg);
      const membership = await active.getActiveMembership(owner.id);
      expect(membership).toMatchObject({
        organizationId: home,
        role: 'owner',
        organization: { id: home, name: 'Our home', type: 'HOUSEHOLD' },
      });
    });

    it('creates a personal household for a user without one', async () => {
      const membership = await active.getActiveMembership(loner.id);
      expect(membership).toMatchObject({ organizationId: `household-${loner.id}`, role: 'owner' });
    });

    it('treats viewers as read-only for writes', async () => {
      as(home);
      expect(await active.getWritableMembership(viewer.id)).toEqual({
        ok: false,
        error: active.VIEW_ONLY_ERROR,
      });
      const writable = await active.getWritableMembership(admin.id);
      expect(writable.ok && writable.membership.organizationId).toBe(home);
    });

    it('lists every organization with its type and role', async () => {
      expect(await active.listUserOrganizations(owner.id)).toEqual([
        { id: home, name: 'Our home', type: 'HOUSEHOLD', role: 'owner' },
        { id: ownerSpare, name: 'Summer house', type: 'HOUSEHOLD', role: 'owner' },
      ]);
    });
  });

  describe('invite -> accept -> active organization', () => {
    let invitationId = '';

    it('lets an owner invite by email with an unguessable id', async () => {
      as(home);
      const result = await lib.inviteMember(owner.id, {
        email: `  PARTNER-${run}@Example.COM `,
        role: 'member',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      invitationId = result.data.id;
      expect(invitationId).toMatch(/^inv_[A-Za-z0-9_-]{32}$/);
      const stored = await client.invitation.findUniqueOrThrow({ where: { id: invitationId } });
      expect(stored).toMatchObject({
        email: partner.email,
        role: 'member',
        status: 'pending',
        organizationId: home,
        inviterId: owner.id,
      });
    });

    it('refuses duplicates, existing members and people who cannot invite', async () => {
      as(home);
      expect(await lib.inviteMember(owner.id, { email: partner.email, role: 'viewer' })).toMatchObject({ ok: false });
      expect(await lib.inviteMember(owner.id, { email: admin.email.toUpperCase(), role: 'member' })).toEqual({
        ok: false,
        error: 'This person is already a member.',
      });
      expect(await lib.inviteMember(admin.id, { email: `new-${run}@example.com`, role: 'admin' })).toEqual({
        ok: false,
        error: 'Only the owner can invite someone as an admin.',
      });
      expect(await lib.inviteMember(viewer.id, { email: `new-${run}@example.com`, role: 'viewer' })).toEqual({
        ok: false,
        error: 'Only owners and admins can invite people.',
      });
    });

    it('falls back to a direct insert when Better-Auth refuses', async () => {
      as(home);
      const result = await lib.inviteMember(
        admin.id,
        { email: `fallback-${run}@example.com`, role: 'viewer' },
        async () => {
          throw new Error('schema mismatch');
        }
      );
      expect(result.ok && result.data.id).toMatch(/^inv_/);
    });

    it('shows invitation details only to the recipient', async () => {
      expect(await lib.getInvitationForUser(outsider.id, invitationId)).toMatchObject({
        ok: false,
        error: expect.stringContaining('different email address'),
      });
      expect(await lib.getInvitationForUser(partner.id, invitationId)).toMatchObject({
        ok: true,
        data: { organizationName: 'Our home', role: 'member', alreadyMember: false },
      });
    });

    it('lists the invitation only for a recipient whose email is verified', async () => {
      // Sign-up does not verify emails: an account that merely claims the invitee's
      // address must not see (or learn the id of) the invitation without the link.
      as(partnerPersonal);
      const unverified = await lib.getHouseholdData(partner.id);
      expect(unverified.ok && unverified.data.invitationsForYou).toEqual([]);

      await client.user.update({ where: { id: partner.id }, data: { emailVerified: true } });
      try {
        const verified = await lib.getHouseholdData(partner.id);
        expect(verified.ok && verified.data.invitationsForYou.map((i) => i.id)).toEqual([invitationId]);
      } finally {
        await client.user.update({ where: { id: partner.id }, data: { emailVerified: null } });
      }
    });

    it('lists pending invitations for managers only', async () => {
      as(home);
      const forOwner = await lib.getHouseholdData(owner.id);
      expect(forOwner.ok && forOwner.data.invitations.map((i) => i.email)).toEqual(
        expect.arrayContaining([partner.email, `fallback-${run}@example.com`])
      );
      const forViewer = await lib.getHouseholdData(viewer.id);
      expect(forViewer.ok && forViewer.data.invitations).toEqual([]);
    });

    it('only the recipient can accept, once (with the link, verified or not)', async () => {
      expect(await lib.acceptInvitation(outsider.id, invitationId)).toMatchObject({ ok: false });
      expect(
        (await client.user.findUniqueOrThrow({ where: { id: partner.id } })).emailVerified
      ).toBeFalsy();
      expect(await lib.acceptInvitation(partner.id, invitationId)).toEqual({
        ok: true,
        data: { organizationId: home },
      });
      expect(await memberRole(partner.id, home)).toBe('member');
      expect(
        (await client.invitation.findUniqueOrThrow({ where: { id: invitationId } })).status
      ).toBe('accepted');
      expect(await lib.acceptInvitation(partner.id, invitationId)).toMatchObject({
        ok: false,
        error: expect.stringContaining('already been used'),
      });

      // The action then stores the organization in the cookie; it becomes active.
      as(home);
      const data = await lib.getHouseholdData(partner.id);
      expect(data.ok && data.data.organization.id).toBe(home);
      expect(data.ok && data.data.members.map((m) => m.userId)).toContain(partner.id);
    });

    it('rejects expired invitations and lets recipients decline', async () => {
      await client.invitation.createMany({
        data: [
          {
            id: `hm-expired-${run}`,
            organizationId: otherOrg,
            email: partner.email,
            role: 'member',
            status: 'pending',
            expiresAt: new Date('2020-01-01'),
            inviterId: outsider.id,
          },
          {
            id: `hm-decline-${run}`,
            organizationId: otherOrg,
            email: partner.email,
            role: 'member',
            status: 'pending',
            expiresAt: new Date('2099-01-01'),
            inviterId: outsider.id,
          },
        ],
      });
      expect(await lib.acceptInvitation(partner.id, `hm-expired-${run}`)).toMatchObject({
        ok: false,
        error: expect.stringContaining('expired'),
      });
      expect(await lib.declineInvitation(outsider.id, `hm-decline-${run}`)).toMatchObject({ ok: false });
      expect(await lib.declineInvitation(partner.id, `hm-decline-${run}`)).toEqual({ ok: true, data: null });
      expect(
        (await client.invitation.findUniqueOrThrow({ where: { id: `hm-decline-${run}` } })).status
      ).toBe('rejected');
      expect(await memberRole(partner.id, otherOrg)).toBeNull();
    });

    it('lets only owners and admins of that organization cancel', async () => {
      const pending = await client.invitation.findFirstOrThrow({
        where: { organizationId: home, email: `fallback-${run}@example.com` },
      });
      expect(await lib.cancelInvitation(viewer.id, pending.id)).toMatchObject({ ok: false });
      expect(await lib.cancelInvitation(outsider.id, pending.id)).toEqual({
        ok: false,
        error: 'Invitation not found',
      });
      expect(await lib.cancelInvitation(admin.id, pending.id)).toEqual({
        ok: true,
        data: { organizationId: home },
      });
      expect(await client.invitation.findUnique({ where: { id: pending.id } })).toBeNull();
    });
  });

  describe('role rules', () => {
    const partnerMember = async () =>
      (await client.member.findFirstOrThrow({ where: { userId: partner.id, organizationId: home } })).id;

    it('only the owner promotes to admin', async () => {
      const id = await partnerMember();
      expect(await lib.updateMemberRole(admin.id, id, 'admin')).toMatchObject({ ok: false });
      expect(await lib.updateMemberRole(viewer.id, id, 'viewer')).toMatchObject({ ok: false });
      expect(await lib.updateMemberRole(owner.id, id, 'admin')).toMatchObject({ ok: true });
      expect(await memberRole(partner.id, home)).toBe('admin');
      // Admins cannot demote other admins.
      expect(await lib.updateMemberRole(admin.id, id, 'member')).toMatchObject({ ok: false });
      expect(await lib.updateMemberRole(owner.id, id, 'member')).toMatchObject({ ok: true });
    });

    it('admins may set member and viewer', async () => {
      const id = `hm-m-viewer-${run}`;
      expect(await lib.updateMemberRole(admin.id, id, 'member')).toMatchObject({ ok: true });
      expect(await lib.updateMemberRole(admin.id, id, 'viewer')).toMatchObject({ ok: true });
      expect(await memberRole(viewer.id, home)).toBe('viewer');
    });

    it('nobody changes the owner, their own role, or roles elsewhere', async () => {
      expect(await lib.updateMemberRole(admin.id, `hm-m-owner-${run}`, 'member')).toMatchObject({ ok: false });
      expect(await lib.updateMemberRole(owner.id, `hm-m-owner-${run}`, 'admin')).toMatchObject({ ok: false });
      expect(await lib.updateMemberRole(admin.id, `hm-m-outsider-${run}`, 'viewer')).toEqual({
        ok: false,
        error: 'Member not found',
      });
      expect(await memberRole(owner.id, home)).toBe('owner');
    });

    it('owners cannot be removed and admins cannot remove', async () => {
      expect(await lib.removeMember(admin.id, `hm-m-viewer-${run}`)).toMatchObject({ ok: false });
      expect(await lib.removeMember(owner.id, `hm-m-owner-${run}`)).toMatchObject({ ok: false });
    });

    it('the last owner must transfer ownership before leaving', async () => {
      expect(await lib.leaveOrganization(owner.id, home)).toEqual({
        ok: false,
        error: 'Transfer ownership to someone else before you leave.',
      });
      expect(await lib.transferOwnership(admin.id, await partnerMember())).toMatchObject({ ok: false });
      expect(await lib.transferOwnership(owner.id, await partnerMember())).toMatchObject({ ok: true });
      expect(await memberRole(partner.id, home)).toBe('owner');
      expect(await memberRole(owner.id, home)).toBe('admin');
      const owners = await client.member.count({ where: { organizationId: home, role: 'owner' } });
      expect(owners).toBe(1);

      expect(await lib.leaveOrganization(owner.id, home)).toEqual({ ok: true, data: { organizationId: home } });
      expect(await memberRole(owner.id, home)).toBeNull();
      // Their other household is now the active fallback.
      expect((await active.resolveActiveMembership(owner.id, home))?.organizationId).toBe(ownerSpare);
    });

    it('nobody leaves their only organization', async () => {
      expect(await lib.leaveOrganization(viewer.id, home)).toMatchObject({
        ok: false,
        error: expect.stringContaining('only space'),
      });
    });

    it('the new owner can remove a member', async () => {
      expect(await lib.removeMember(partner.id, `hm-m-viewer-${run}`)).toMatchObject({ ok: true });
      expect(await memberRole(viewer.id, home)).toBeNull();
    });
  });

  it('creates an organization with its type and makes the creator owner', async () => {
    const result = await lib.createOrganization(loner.id, { name: 'Co-op Kitchen', type: 'COLLECTIVE' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const created = await client.organization.findUniqueOrThrow({
      where: { id: result.data.organizationId },
      include: { members: true },
    });
    expect(created).toMatchObject({ name: 'Co-op Kitchen', type: 'COLLECTIVE' });
    expect(created.slug).toMatch(/^co-op-kitchen-[0-9a-f]{8}$/);
    expect(created.members).toEqual([expect.objectContaining({ userId: loner.id, role: 'owner' })]);
    await client.organization.delete({ where: { id: created.id } });
  });
});
