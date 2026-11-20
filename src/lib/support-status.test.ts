import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient, type Prisma } from '@prisma/client';
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

  const sharing = (level: 'NONE' | 'PHASE' | 'ENERGY' | 'FULL', extra: Partial<Prisma.UserCreateInput> = {}) => ({
    enableCycleTracking: true,
    lastPeriodDate,
    cycleLength: 28,
    shareCycleStatus: true,
    shareCycleLevel: level,
    ...extra,
  });
  const person = (key: string, name: string, extra: Partial<Prisma.UserCreateInput> = {}) => ({
    id: `ss-${key}-${run}`,
    email: `ss-${key}-${run}@example.com`,
    name,
    ...extra,
  });

  // The viewer shares too, to prove nobody sees their own card.
  const viewer = person('viewer', 'Vera Viewer', {
    focusPreference: 'hormonal',
    ...sharing('FULL'),
  });
  const full = person('full', 'Mikael Andersson', {
    timezone: 'Europe/Stockholm',
    ...sharing('FULL'),
  });
  const phaseOnly = person('phase', 'Pia Phase', sharing('PHASE'));
  const notOptedIn = person('off', 'Nils Off', sharing('FULL', { shareCycleStatus: false }));
  const levelNone = person('none', 'Nora None', sharing('NONE'));
  const noTracking = person('notrack', 'Tove Untracked', sharing('FULL', { enableCycleTracking: false }));
  const noPeriod = person('noperiod', 'Tim Nodate', sharing('FULL', { lastPeriodDate: null }));
  const outsider = person('outsider', 'Otto Outsider', sharing('FULL'));
  const allUsers = [viewer, full, phaseOnly, notOptedIn, levelNone, noTracking, noPeriod, outsider];

  const home = `ss-home-${run}`;
  const collective = `ss-collective-${run}`;
  const club = `ss-club-${run}`;
  const work = `ss-work-${run}`;
  const elsewhere = `ss-elsewhere-${run}`;
  const allOrgs = [home, collective, club, work, elsewhere];
  const fullHomeMemberId = `ss-m-full-home-${run}`;

  let pool: Pool;
  let client: PrismaClient;
  let lib: typeof import('./support-status');

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
        { id: collective, name: 'Garden collective', slug: collective, type: 'COLLECTIVE' },
        { id: club, name: 'Running club', slug: club, type: 'COMMUNITY' },
        { id: work, name: 'Office', slug: work, type: 'CORPORATE' },
        { id: elsewhere, name: 'Another home', slug: elsewhere, type: 'HOUSEHOLD' },
      ],
    });
    let minute = 0;
    const member = (organizationId: string, userId: string, id: string = randomUUID()) => ({
      id,
      organizationId,
      userId,
      role: 'member',
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, minute++)),
    });
    await client.member.createMany({
      data: [
        member(home, viewer.id),
        member(home, full.id, fullHomeMemberId),
        member(home, phaseOnly.id),
        member(home, notOptedIn.id),
        member(home, levelNone.id),
        member(home, noTracking.id),
        member(home, noPeriod.id),
        member(collective, viewer.id),
        member(collective, full.id),
        member(club, viewer.id),
        member(club, full.id),
        member(work, viewer.id),
        member(work, full.id),
        member(elsewhere, outsider.id),
      ],
    });
    // Today's journal: energy may be shared, nothing else ever is.
    for (const [userId, energy] of [
      [full.id, 3],
      [phaseOnly.id, 9],
      [notOptedIn.id, 4],
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

  it('shows the household only the members who opted in, as projected for the viewer', async () => {
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

  it('never sends journal text, symptoms, other metrics or people who did not opt in', async () => {
    const json = JSON.stringify(await lib.getSupportStatusBoard(viewer.id, home, now));
    for (const hidden of [
      'secret',
      'Andersson',
      full.email,
      viewer.id,
      notOptedIn.id,
      levelNone.id,
      noTracking.id,
      noPeriod.id,
      outsider.id,
      'Nils',
      'Nora',
      'Tove',
      'Tim',
      'Otto',
      '"mood"',
      '"sleepHours"',
      '4.5',
    ]) {
      expect(json).not.toContain(hidden);
    }
  });

  it('shows nothing individual in collectives, communities or workplaces', async () => {
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

  it('takes effect immediately when someone turns sharing off, changes level or leaves', async () => {
    const idsInHome = async () =>
      (await lib.getSupportStatusBoard(viewer.id, home, now))?.statuses.map((s) => s.id);

    await lib.updateCycleSharingSettings(full.id, { shareCycleStatus: false });
    expect(await idsInHome()).toEqual([phaseOnly.id]);

    await lib.updateCycleSharingSettings(full.id, { shareCycleStatus: true, shareCycleLevel: 'ENERGY' });
    const board = await lib.getSupportStatusBoard(viewer.id, home, now);
    expect(board?.statuses[0]).toMatchObject({ level: 'ENERGY', todayEnergy: 3 });
    expect(JSON.stringify(board)).not.toContain('quiet evening');

    await client.member.delete({ where: { id: fullHomeMemberId } });
    expect(await idsInHome()).toEqual([phaseOnly.id]);
    await client.member.create({
      data: { id: fullHomeMemberId, organizationId: home, userId: full.id, role: 'member' },
    });
    await lib.updateCycleSharingSettings(full.id, { shareCycleLevel: 'FULL' });
  });

  it('stores the support message encrypted and returns it decrypted', async () => {
    const settings = await lib.updateCycleSharingSettings(phaseOnly.id, {
      supportMessage: 'Snacks and patience',
    });
    expect(settings).toMatchObject({
      shareCycleStatus: true,
      shareCycleLevel: 'PHASE',
      supportMessage: 'Snacks and patience',
      cycleConfigured: true,
      effectiveLevel: 'PHASE',
    });
    const raw = await client.user.findUniqueOrThrow({
      where: { id: phaseOnly.id },
      select: { supportMessage: true },
    });
    expect(raw.supportMessage).not.toContain('Snacks');
    expect(decrypt(raw.supportMessage)).toBe('Snacks and patience');
    // PHASE does not reveal the message.
    const board = await lib.getSupportStatusBoard(viewer.id, home, now);
    expect(JSON.stringify(board)).not.toContain('Snacks');

    const cleared = await lib.updateCycleSharingSettings(phaseOnly.id, { supportMessage: '' });
    expect(cleared.supportMessage).toBeNull();
    expect(await lib.getCycleSharingSettings(noTracking.id)).toMatchObject({
      cycleConfigured: false,
      effectiveLevel: 'NONE',
    });
  });

  it('builds the Profile panel with the households that would see it', async () => {
    const data = await lib.getCycleSharingPanelData(full.id, now);
    expect(data?.households).toEqual([{ id: home, name: 'Our home', otherMemberCount: 6 }]);
    expect(data?.preview).toMatchObject({
      id: full.id,
      name: 'Mikael Andersson',
      snapshot: expectedSnapshot(),
      todayEnergy: 3,
      // 10:00 UTC is 12:00 in Stockholm.
      timeOfDay: 'afternoon',
    });
    expect(await lib.getCycleSharingPanelData(`missing-${run}`, now)).toBeNull();
  });
});
