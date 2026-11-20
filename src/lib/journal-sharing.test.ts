import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { encrypt, encryptArray } from './encryption';

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = Boolean(
  url &&
  ['localhost', '127.0.0.1'].includes(url.hostname) &&
  url.pathname === '/healthhub_e2e'
);

// Sharing never depends on the active organization, but the module graph reads cookies.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

describe.skipIf(!isolated)('journal sharing against isolated PostgreSQL', () => {
  const run = randomUUID().slice(0, 8);
  const user = (key: string) => ({
    id: `js-${key}-${run}`,
    email: `js-${key}-${run}@example.com`,
    name: `${key[0].toUpperCase()}${key.slice(1)} ${run}`,
  });
  const author = user('author');
  const partner = user('partner');
  const outsider = user('outsider');
  const allUsers = [author, partner, outsider];

  const home = `js-home-${run}`;
  const collective = `js-collective-${run}`;
  const club = `js-club-${run}`;
  const work = `js-work-${run}`;
  const elsewhere = `js-elsewhere-${run}`;
  const allOrgs = [home, collective, club, work, elsewhere];

  const sharedDay = '2026-02-10';
  const collectiveDay = '2026-02-11';
  const missingDay = '2026-02-12';
  const authorHomeMemberId = `js-m-author-home-${run}`;

  let pool: Pool;
  let client: PrismaClient;
  let lib: typeof import('./journal-sharing');
  let household: typeof import('./household-management');

  const entryRow = (date: string) =>
    client.journalEntry.findUniqueOrThrow({
      where: { userId_date: { userId: author.id, date: new Date(`${date}T00:00:00Z`) } },
    });
  const addAuthorToHome = () =>
    client.member.create({
      data: { id: authorHomeMemberId, organizationId: home, userId: author.id, role: 'member' },
    });

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    lib = await import('./journal-sharing');
    household = await import('./household-management');

    for (const u of allUsers) await client.user.create({ data: u });
    await client.organization.createMany({
      data: [
        { id: home, name: 'Shared home', slug: home, type: 'HOUSEHOLD' },
        { id: collective, name: 'Garden collective', slug: collective, type: 'COLLECTIVE' },
        { id: club, name: 'Running club', slug: club, type: 'COMMUNITY' },
        { id: work, name: 'Office', slug: work, type: 'CORPORATE' },
        { id: elsewhere, name: 'Not yours', slug: elsewhere, type: 'HOUSEHOLD' },
      ],
    });
    const at = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 0, minutes));
    await client.member.createMany({
      data: [
        { id: `js-m-partner-home-${run}`, organizationId: home, userId: partner.id, role: 'owner', createdAt: at(1) },
        { id: authorHomeMemberId, organizationId: home, userId: author.id, role: 'member', createdAt: at(2) },
        { id: `js-m-author-col-${run}`, organizationId: collective, userId: author.id, role: 'owner', createdAt: at(3) },
        { id: `js-m-author-club-${run}`, organizationId: club, userId: author.id, role: 'owner', createdAt: at(4) },
        { id: `js-m-partner-club-${run}`, organizationId: club, userId: partner.id, role: 'member', createdAt: at(5) },
        { id: `js-m-author-work-${run}`, organizationId: work, userId: author.id, role: 'member', createdAt: at(6) },
        { id: `js-m-outsider-${run}`, organizationId: elsewhere, userId: outsider.id, role: 'owner', createdAt: at(7) },
      ],
    });
    for (const date of [sharedDay, collectiveDay]) {
      await client.journalEntry.create({
        data: {
          userId: author.id,
          date: new Date(`${date}T00:00:00Z`),
          mood: 7,
          sleepHours: 7.5,
          tags: ['calm'],
          notes: encrypt(`Quiet day ${date}`),
          gratitudeEntries: encryptArray(['Morning tea']) ?? [],
          symptomsPhysical: encryptArray(['Tired legs']) ?? [],
        },
      });
    }
  });

  afterAll(async () => {
    await client.organization.deleteMany({ where: { id: { in: allOrgs } } });
    await client.user.deleteMany({ where: { id: { in: allUsers.map((u) => u.id) } } });
    await client.$disconnect();
    await pool.end();
  });

  it('offers only households and collectives as share targets', async () => {
    expect(await lib.getJournalShareTargets(author.id)).toEqual([
      { id: home, name: 'Shared home', type: 'HOUSEHOLD' },
      { id: collective, name: 'Garden collective', type: 'COLLECTIVE' },
    ]);
    expect(await lib.getJournalShareTargets(outsider.id)).toEqual([
      { id: elsewhere, name: 'Not yours', type: 'HOUSEHOLD' },
    ]);
  });

  it('refuses communities, workplaces, other people’s spaces and unsaved days', async () => {
    for (const organizationId of [club, work]) {
      expect(await lib.setJournalEntrySharing(author.id, sharedDay, organizationId)).toEqual({
        ok: false,
        error: 'Journal entries can only be shared with a household or collective.',
      });
    }
    expect(await lib.setJournalEntrySharing(author.id, sharedDay, elsewhere)).toEqual({
      ok: false,
      error: 'You are not a member of that space.',
    });
    expect(await lib.setJournalEntrySharing(author.id, missingDay, home)).toEqual({
      ok: false,
      error: 'Save this journal entry before sharing it.',
    });
    expect(await entryRow(sharedDay)).toMatchObject({
      visibility: 'PRIVATE',
      sharedOrganizationId: null,
    });
  });

  it('shares one day with a household without touching its content', async () => {
    const before = await entryRow(sharedDay);
    expect(await lib.setJournalEntrySharing(author.id, sharedDay, home)).toEqual({
      ok: true,
      data: { visibility: 'ORGANIZATION', sharedOrganizationId: home },
    });
    const after = await entryRow(sharedDay);
    expect(after.notes).toBe(before.notes);
    expect(after.symptomsPhysical).toEqual(before.symptomsPhysical);
    expect(await lib.setJournalEntrySharing(author.id, collectiveDay, collective)).toMatchObject({
      ok: true,
    });
  });

  it('shows the shared day, decrypted, to members of that household only', async () => {
    const forPartner = await lib.getSharedJournalEntries(partner.id, home);
    expect(forPartner).toEqual([
      expect.objectContaining({
        date: sharedDay,
        authorName: author.name,
        isYours: false,
        mood: 7,
        sleepHours: 7.5,
        tags: ['calm'],
        notes: `Quiet day ${sharedDay}`,
        gratitudeEntries: ['Morning tea'],
        symptomsPhysical: ['Tired legs'],
      }),
    ]);
    expect((await lib.getSharedJournalEntries(author.id, home))[0]?.isYours).toBe(true);
    expect(await lib.getSharedJournalEntries(outsider.id, home)).toEqual([]);
    // The partner is not in the collective, so that day stays out of reach.
    expect(await lib.getSharedJournalEntries(partner.id, collective)).toEqual([]);
  });

  it('never shows individual entries in a community, even if a row says otherwise', async () => {
    await client.journalEntry.update({
      where: { id: (await entryRow(sharedDay)).id },
      data: { visibility: 'ORGANIZATION', sharedOrganizationId: club },
    });
    expect(await lib.getSharedJournalEntries(partner.id, club)).toEqual([]);
    expect(await lib.getSharedJournalEntries(author.id, club)).toEqual([]);
    await lib.setJournalEntrySharing(author.id, sharedDay, home);
  });

  it('hides entries from authors who are no longer members', async () => {
    await client.member.delete({ where: { id: authorHomeMemberId } });
    expect(await lib.getSharedJournalEntries(partner.id, home)).toEqual([]);
    await addAuthorToHome();
    expect(await lib.getSharedJournalEntries(partner.id, home)).toHaveLength(1);
  });

  it('can be made private again', async () => {
    expect(await lib.setJournalEntrySharing(author.id, sharedDay, null)).toEqual({
      ok: true,
      data: { visibility: 'PRIVATE', sharedOrganizationId: null },
    });
    expect(await lib.getSharedJournalEntries(partner.id, home)).toEqual([]);
  });

  it('unshares when the author leaves, keeping what was shared elsewhere', async () => {
    await lib.setJournalEntrySharing(author.id, sharedDay, home);
    expect(await household.leaveOrganization(author.id, home)).toMatchObject({ ok: true });
    expect(await entryRow(sharedDay)).toMatchObject({
      visibility: 'PRIVATE',
      sharedOrganizationId: null,
    });
    expect(await entryRow(collectiveDay)).toMatchObject({
      visibility: 'ORGANIZATION',
      sharedOrganizationId: collective,
    });
  });

  it('unshares when the author is removed', async () => {
    await addAuthorToHome();
    await lib.setJournalEntrySharing(author.id, sharedDay, home);
    expect(await household.removeMember(partner.id, authorHomeMemberId)).toMatchObject({
      ok: true,
    });
    expect(await entryRow(sharedDay)).toMatchObject({
      visibility: 'PRIVATE',
      sharedOrganizationId: null,
    });
    expect(await lib.getSharedJournalEntries(partner.id, home)).toEqual([]);
  });
});
