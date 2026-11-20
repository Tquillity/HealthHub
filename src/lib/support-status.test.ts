import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient, type CycleShareLevel, type Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { decrypt, encrypt, encryptArray } from './encryption';
import { calculateCyclePhase } from './cycle-calculator';
import { buildSupportSuggestion, toCycleSnapshot } from './cycle-status-sharing';

const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isolated = Boolean(
  url &&
  ['localhost', '127.0.0.1'].includes(url.hostname) &&
  url.pathname === '/healthhub_e2e'
);

// The board never depends on the active organization, but the module graph reads cookies.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

describe.skipIf(!isolated)('support status against isolated PostgreSQL', () => {
  const run = randomUUID().slice(0, 8);
  const lastPeriodDate = new Date('2026-05-01T00:00:00Z');
  // Fixed clock for "today" (journal energy) and time of day: 10:00 UTC, a morning.
  const now = new Date('2026-06-15T10:00:00Z');
  const today = new Date('2026-06-15T00:00:00Z');
  const tracking = { enableCycleTracking: true, lastPeriodDate, cycleLength: 28 };
  const person = (key: string, name: string, extra: Partial<Prisma.UserCreateInput> = {}) => ({
    id: `ss-${key}-${run}`,
    email: `ss-${key}-${run}@example.com`,
    name,
    ...tracking,
    ...extra,
  });

  // The viewer shares too, to prove nobody sees their own card.
  const viewer = person('viewer', 'Vera Viewer', { focusPreference: 'hormonal' });
  const full = person('full', 'Mikael Andersson', { timezone: 'Europe/Stockholm' });
  const phaseOnly = person('phase', 'Pia Phase');
  const notSharing = person('off', 'Nils Off');
  const noTracking = person('notrack', 'Tove Untracked', { enableCycleTracking: false });
  const noPeriod = person('noperiod', 'Tim Nodate', { lastPeriodDate: null });
  const outsider = person('outsider', 'Otto Outsider');
  // Joins the household after everyone above agreed to share.
  const lateJoiner = person('late', 'Carol Later');
  // In a second household with Mikael, where Mikael shares nothing.
  const otherHomeMate = person('mate', 'Gus Mate');
  const allUsers = [
    viewer,
    full,
    phaseOnly,
    notSharing,
    noTracking,
    noPeriod,
    outsider,
    lateJoiner,
    otherHomeMate,
  ];

  const home = `ss-home-${run}`;
  const otherHome = `ss-other-home-${run}`;
  const collective = `ss-collective-${run}`;
  const club = `ss-club-${run}`;
  const work = `ss-work-${run}`;
  const elsewhere = `ss-elsewhere-${run}`;
  const allOrgs = [home, otherHome, collective, club, work, elsewhere];

  const at = (month: number, minute = 0) => new Date(Date.UTC(2026, month - 1, 1, 0, minute));
  // Everyone below agreed on February 1, covering the members who had joined by then.
  const agreedAt = at(2);

  let pool: Pool;
  let client: PrismaClient;
  let lib: typeof import('./support-status');

  let shareSeq = 0;
  const share = (
    userId: string,
    organizationId: string,
    level: CycleShareLevel,
    coversMembersJoinedBy = agreedAt
  ) => ({
    id: randomUUID(),
    userId,
    organizationId,
    level,
    coversMembersJoinedBy,
    createdAt: at(2, shareSeq++),
  });

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    client = new PrismaClient({ adapter: new PrismaPg(pool) });
    lib = await import('./support-status');

    for (const user of allUsers) await client.user.create({ data: user });
    await client.user.update({
      where: { id: full.id },
      data: { supportMessage: encrypt('A quiet evening would be lovely') },
    });
    await client.organization.createMany({
      data: [
        { id: home, name: 'Our home', slug: home, type: 'HOUSEHOLD' },
        { id: otherHome, name: 'Parents home', slug: otherHome, type: 'HOUSEHOLD' },
        { id: collective, name: 'Garden collective', slug: collective, type: 'COLLECTIVE' },
        { id: club, name: 'Running club', slug: club, type: 'COMMUNITY' },
        { id: work, name: 'Office', slug: work, type: 'CORPORATE' },
        { id: elsewhere, name: 'Another home', slug: elsewhere, type: 'HOUSEHOLD' },
      ],
    });
    let minute = 0;
    const member = (organizationId: string, userId: string, createdAt = at(1, minute++)) => ({
      id: randomUUID(),
      organizationId,
      userId,
      role: 'member',
      createdAt,
    });
    await client.member.createMany({
      data: [
        member(home, viewer.id),
        member(home, full.id),
        member(home, phaseOnly.id),
        member(home, notSharing.id),
        member(home, noTracking.id),
        member(home, noPeriod.id),
        member(home, lateJoiner.id, at(3)),
        member(otherHome, full.id),
        member(otherHome, otherHomeMate.id),
        member(collective, viewer.id),
        member(collective, full.id),
        member(club, viewer.id),
        member(club, full.id),
        member(work, viewer.id),
        member(work, full.id),
        member(elsewhere, outsider.id),
      ],
    });
    // Rows written directly, as if the checks had been bypassed: the board must still refuse
    // to show anything in collectives, communities and workplaces.
    await client.cycleStatusShare.createMany({
      data: [
        share(full.id, home, 'FULL'),
        share(phaseOnly.id, home, 'PHASE'),
        share(viewer.id, home, 'FULL'),
        share(noTracking.id, home, 'FULL'),
        share(noPeriod.id, home, 'FULL'),
        share(outsider.id, elsewhere, 'FULL'),
        share(full.id, collective, 'FULL'),
        share(full.id, club, 'FULL'),
        share(full.id, work, 'FULL'),
      ],
    });
    // Today's journal: energy may be shared, nothing else ever is.
    for (const [userId, energy] of [
      [full.id, 3],
      [phaseOnly.id, 9],
      [notSharing.id, 4],
    ] as const) {
      await client.journalEntry.create({
        data: {
          userId,
          date: today,
          energy,
          mood: 2,
          sleepHours: 4.5,
          notes: encrypt(`secret journal note ${userId}`),
          symptomsPhysical: encryptArray(['secret cramps']) ?? [],
          symptomsMental: encryptArray(['secret anxiety']) ?? [],
        },
      });
    }
  });

  afterAll(async () => {
    await client.organization.deleteMany({ where: { id: { in: allOrgs } } });
    await client.user.deleteMany({ where: { id: { in: allUsers.map((user) => user.id) } } });
    await client.$disconnect();
    await pool.end();
  });

  const expectedSnapshot = () => toCycleSnapshot(calculateCyclePhase(lastPeriodDate, 28), 28);
  const idsIn = async (viewerId: string, organizationId: string) =>
    (await lib.getSupportStatusBoard(viewerId, organizationId, now))?.statuses.map((s) => s.id);
  const panelHousehold = async (userId: string, organizationId: string) => {
    const data = await lib.getCycleSharingPanelData(userId, now);
    const household = data?.households.find((h) => h.id === organizationId);
    if (!household) throw new Error('household missing from the panel');
    return household;
  };

  it('shows the household only the members who share with it, as projected for the viewer', async () => {
    const board = await lib.getSupportStatusBoard(viewer.id, home, now);
    expect(board).not.toBeNull();
    expect(board?.sharingAllowed).toBe(true);
    expect(board?.otherMemberCount).toBe(6);
    expect(board?.statuses.map((status) => status.id)).toEqual([full.id, phaseOnly.id]);

    const snapshot = expectedSnapshot();
    const [mikael, pia] = board?.statuses ?? [];
    expect(mikael).toEqual({
      level: 'FULL',
      id: full.id,
      firstName: 'Mikael',
      phase: expect.objectContaining({ key: snapshot.phase }),
      // Hormonal focus (the viewer's), morning, and Mikael's low logged energy.
      suggestion: buildSupportSuggestion({
        firstName: 'Mikael',
        phase: snapshot.phase,
        viewerFocus: 'hormonal',
        timeOfDay: 'morning',
        todayEnergy: 3,
      }),
      typicalEnergy: expect.objectContaining({ summary: expect.any(String) }),
      todayEnergy: 3,
      cycleDay: snapshot.cycleDay,
      daysUntilNextPeriod: snapshot.daysUntilNextPeriod,
      supportMessage: 'A quiet evening would be lovely',
    });
    expect(pia).toEqual({
      level: 'PHASE',
      id: phaseOnly.id,
      firstName: 'Pia',
      phase: expect.objectContaining({ key: snapshot.phase }),
      suggestion: buildSupportSuggestion({
        firstName: 'Pia',
        phase: snapshot.phase,
        viewerFocus: 'hormonal',
        timeOfDay: 'morning',
      }),
    });
  });

  it('never sends journal text, symptoms, other metrics or people who do not share', async () => {
    const json = JSON.stringify(await lib.getSupportStatusBoard(viewer.id, home, now));
    for (const hidden of [
      'secret',
      'Andersson',
      full.email,
      viewer.id,
      notSharing.id,
      noTracking.id,
      noPeriod.id,
      outsider.id,
      lateJoiner.id,
      'Nils',
      'Tove',
      'Tim',
      'Otto',
      'Carol',
      '"mood"',
      '"sleepHours"',
      '4.5',
    ]) {
      expect(json).not.toContain(hidden);
    }
  });

  it('keeps a share to the household it names, never another household the sharer is in', async () => {
    expect(await idsIn(otherHomeMate.id, otherHome)).toEqual([]);
    const board = await lib.getSupportStatusBoard(otherHomeMate.id, otherHome, now);
    expect(JSON.stringify(board)).not.toContain(full.id);
    expect(board).toMatchObject({ sharingAllowed: true, otherMemberCount: 1, statuses: [] });
  });

  it('shows nothing individual in collectives, communities or workplaces, whatever the rows say', async () => {
    for (const organizationId of [collective, club, work]) {
      const board = await lib.getSupportStatusBoard(viewer.id, organizationId, now);
      expect(board).toMatchObject({ sharingAllowed: false, statuses: [] });
      expect(JSON.stringify(board)).not.toContain(full.id);
    }
  });

  it('shows nothing to people outside the household', async () => {
    expect(await lib.getSupportStatusBoard(outsider.id, home, now)).toBeNull();
    expect(await lib.getSupportStatusBoard(viewer.id, elsewhere, now)).toBeNull();
    const own = await lib.getSupportStatusBoard(outsider.id, elsewhere, now);
    expect(own).toMatchObject({ sharingAllowed: true, otherMemberCount: 0, statuses: [] });
  });

  it('shows nothing to someone who joined after the sharer agreed, until the sharer includes them', async () => {
    expect(await idsIn(lateJoiner.id, home)).toEqual([]);

    // Mikael's Profile names Carol as someone who does not see it.
    const listed = await panelHousehold(full.id, home);
    expect(listed.share).toEqual({ level: 'FULL', coversMembersJoinedBy: agreedAt.toISOString() });
    expect(listed.members).toContainEqual({ name: 'Carol Later', seesStatus: false });
    expect(listed.members).toContainEqual({ name: 'Vera Viewer', seesStatus: true });

    // A level change alone does not include her.
    const changed = await lib.setCycleStatusShare(full.id, {
      organizationId: home,
      level: 'ENERGY',
      membersListedAt: listed.membersListedAt,
    });
    expect(changed).toMatchObject({ ok: true });
    expect(await idsIn(lateJoiner.id, home)).toEqual([]);

    const included = await lib.setCycleStatusShare(full.id, {
      organizationId: home,
      level: 'FULL',
      membersListedAt: listed.membersListedAt,
      includeNewMembers: true,
    });
    expect(included.ok && included.data.household.members).toContainEqual({
      name: 'Carol Later',
      seesStatus: true,
    });
    expect(await idsIn(lateJoiner.id, home)).toEqual([full.id]);

    // Back to the shared starting point for the tests below.
    await client.cycleStatusShare.update({
      where: { userId_organizationId: { userId: full.id, organizationId: home } },
      data: { coversMembersJoinedBy: agreedAt },
    });
  });

  it('covers only the members the page listed when sharing starts', async () => {
    // Pia stops, then starts again from a page listed before Carol joined.
    expect(
      await lib.setCycleStatusShare(phaseOnly.id, {
        organizationId: home,
        level: 'NONE',
        membersListedAt: now.toISOString(),
      })
    ).toMatchObject({ ok: true, data: { household: { share: null } } });
    expect(await idsIn(viewer.id, home)).toEqual([full.id]);

    const listedBeforeCarol = at(2, 30).toISOString();
    const started = await lib.setCycleStatusShare(phaseOnly.id, {
      organizationId: home,
      level: 'PHASE',
      membersListedAt: listedBeforeCarol,
    });
    expect(started).toMatchObject({
      ok: true,
      data: {
        cycleConfigured: true,
        household: { share: { level: 'PHASE', coversMembersJoinedBy: listedBeforeCarol } },
      },
    });
    expect(await idsIn(viewer.id, home)).toEqual([full.id, phaseOnly.id]);
    expect(await idsIn(lateJoiner.id, home)).toEqual([]);

    // A page from the future never covers people who have not joined yet.
    const future = await lib.setCycleStatusShare(phaseOnly.id, {
      organizationId: home,
      level: 'PHASE',
      membersListedAt: '2999-01-01T00:00:00.000Z',
      includeNewMembers: true,
    });
    if (!future.ok) throw new Error(future.error);
    const covered = Date.parse(future.data.household.share?.coversMembersJoinedBy ?? '');
    expect(covered).toBeLessThanOrEqual(Date.now());
    await client.cycleStatusShare.update({
      where: { userId_organizationId: { userId: phaseOnly.id, organizationId: home } },
      data: { coversMembersJoinedBy: agreedAt },
    });
  });

  it('refuses spaces that are not the sharer’s household', async () => {
    const listedAt = now.toISOString();
    expect(
      await lib.setCycleStatusShare(full.id, {
        organizationId: collective,
        level: 'PHASE',
        membersListedAt: listedAt,
      })
    ).toEqual({ ok: false, error: lib.CYCLE_SHARING_HOUSEHOLDS_ONLY_ERROR });
    expect(
      await lib.setCycleStatusShare(full.id, {
        organizationId: elsewhere,
        level: 'PHASE',
        membersListedAt: listedAt,
      })
    ).toEqual({ ok: false, error: lib.NOT_A_HOUSEHOLD_MEMBER_ERROR });
    expect(
      await client.cycleStatusShare.count({ where: { userId: full.id, organizationId: elsewhere } })
    ).toBe(0);
  });

  it('takes effect immediately when someone stops sharing or changes level', async () => {
    // Listed before Carol joined, so she stays out of it.
    const listedAt = agreedAt.toISOString();
    await lib.setCycleStatusShare(full.id, { organizationId: home, level: 'NONE', membersListedAt: listedAt });
    expect(await idsIn(viewer.id, home)).toEqual([phaseOnly.id]);
    expect(
      await client.cycleStatusShare.count({ where: { userId: full.id, organizationId: home } })
    ).toBe(0);

    await lib.setCycleStatusShare(full.id, { organizationId: home, level: 'ENERGY', membersListedAt: listedAt });
    const board = await lib.getSupportStatusBoard(viewer.id, home, now);
    expect(board?.statuses.map((s) => s.id)).toEqual([phaseOnly.id, full.id]);
    expect(board?.statuses[1]).toMatchObject({ level: 'ENERGY', todayEnergy: 3 });
    expect(JSON.stringify(board)).not.toContain('quiet evening');
    await lib.setCycleStatusShare(full.id, { organizationId: home, level: 'FULL', membersListedAt: listedAt });
  });

  it('hides a sharer who is no longer a member, even if a share row was left behind', async () => {
    const membership = await client.member.findFirstOrThrow({
      where: { organizationId: home, userId: phaseOnly.id },
    });
    await client.member.delete({ where: { id: membership.id } });
    expect(await idsIn(viewer.id, home)).not.toContain(phaseOnly.id);
    await client.member.create({ data: membership });
  });

  it('stores the support message encrypted and returns it decrypted', async () => {
    expect(await lib.updateSupportMessage(phaseOnly.id, 'Snacks and patience')).toBe(
      'Snacks and patience'
    );
    const raw = await client.user.findUniqueOrThrow({
      where: { id: phaseOnly.id },
      select: { supportMessage: true },
    });
    expect(raw.supportMessage).not.toContain('Snacks');
    expect(decrypt(raw.supportMessage)).toBe('Snacks and patience');
    // PHASE does not reveal the message.
    const board = await lib.getSupportStatusBoard(viewer.id, home, now);
    expect(JSON.stringify(board)).not.toContain('Snacks');

    expect(await lib.updateSupportMessage(phaseOnly.id, '')).toBeNull();
    expect(await lib.getCycleSharingPanelData(noTracking.id, now)).toMatchObject({
      cycleConfigured: false,
    });
  });

  it('builds the Profile panel with every household, its share and who sees it', async () => {
    const data = await lib.getCycleSharingPanelData(full.id, now);
    expect(data?.households.map((h) => [h.id, h.share?.level ?? 'NONE'])).toEqual([
      [home, 'FULL'],
      [otherHome, 'NONE'],
    ]);
    const [ours, parents] = data?.households ?? [];
    expect(ours.members.map((m) => [m.name, m.seesStatus])).toEqual([
      ['Vera Viewer', true],
      ['Pia Phase', true],
      ['Nils Off', true],
      ['Tove Untracked', true],
      ['Tim Nodate', true],
      ['Carol Later', false],
    ]);
    expect(parents.members).toEqual([{ name: 'Gus Mate', seesStatus: false }]);
    expect(Number.isNaN(Date.parse(ours.membersListedAt))).toBe(false);
    expect(data?.supportMessage).toBe('A quiet evening would be lovely');
    expect(data?.cycleConfigured).toBe(true);
    expect(data?.preview).toMatchObject({
      id: full.id,
      name: 'Mikael Andersson',
      snapshot: expectedSnapshot(),
      todayEnergy: 3,
      // 10:00 UTC is 12:00 in Stockholm.
      timeOfDay: 'afternoon',
    });
    expect(await lib.getCycleShareLevel(full.id, home)).toBe('FULL');
    expect(await lib.getCycleShareLevel(full.id, otherHome)).toBe('NONE');
    expect(await lib.getCycleSharingPanelData(`missing-${run}`, now)).toBeNull();
  });
});
