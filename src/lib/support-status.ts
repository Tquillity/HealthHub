import type { CycleShareLevel, OrganizationType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/encryption';
import { dateOnlyToUtcDate } from '@/lib/date-only';
import { canShowIndividualCycleStatus, CYCLE_STATUS_ORG_TYPES } from '@/lib/org-policy';
import { generateRecordId } from '@/lib/record-ids';
import {
  cycleSnapshotOn,
  getEffectiveShareLevel,
  isCoveredByShare,
  levelIncludes,
  parseFocusPreference,
  projectCycleStatus,
  SHARED_LEVELS,
  timeOfDayIn,
  type CycleShareHousehold,
  type CycleSnapshot,
  type ProjectedCycleStatus,
  type SetCycleStatusShareInput,
  type SharedLevel,
  type TimeOfDay,
} from '@/lib/cycle-status-sharing';
import { getLocalDateKey, resolveTimeZone, timeZoneToAdopt } from '@/lib/time-zone';

/**
 * Partner sync (issue #3), server side. Reads and writes each person's per-household shares and
 * builds the Support Status board for one viewer and one organization.
 *
 * Consent is per household (CycleStatusShare): it names the household, the level, and the
 * members it covers. Members who join later see nothing until the sharer includes them, so a
 * new viewer never gets someone's status without that person seeing their name first.
 *
 * Every check happens here, on the server: the viewer must be a member, the organization must
 * be a household (org-policy), and each sharer must still be a member, share with this
 * household and cover the viewer. Only the fields chosen by projectCycleStatus leave this
 * module. People who do not share are filtered out in the query itself, so their cycle data is
 * never even loaded.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export const NOT_A_HOUSEHOLD_MEMBER_ERROR = 'You are not a member of that household.';
export const CYCLE_SHARING_HOUSEHOLDS_ONLY_ERROR =
  'Cycle status can only be shared with a household.';

type CycleFields = {
  enableCycleTracking: boolean;
  lastPeriodDate: Date | null;
  cycleLength: number;
};

function isCycleConfigured(user: CycleFields): boolean {
  return user.enableCycleTracking && user.lastPeriodDate !== null;
}

/**
 * The sharer's own calendar day (`YYYY-MM-DD`): the day in their profile time zone, or in UTC
 * when that is not a zone the runtime knows. Phase, cycle day and "energy logged today" all
 * use this one day, never the server's date.
 */
function sharerDayKey(user: { timezone: string | null }, now: Date): string {
  return getLocalDateKey(now, resolveTimeZone(user.timezone));
}

function cycleSnapshotFor(user: CycleFields, dayKey: string): CycleSnapshot | null {
  if (!user.enableCycleTracking || !user.lastPeriodDate) return null;
  return cycleSnapshotOn(user.lastPeriodDate, user.cycleLength || 28, dayKey);
}

/** Self-logged journal energy per user, each for their own calendar day. */
async function getTodayEnergyByUser(
  people: { userId: string; dayKey: string }[]
): Promise<Map<string, number | null>> {
  const byUser = new Map<string, number | null>();
  if (people.length === 0) return byUser;
  const rows = await prisma.journalEntry.findMany({
    where: {
      OR: people.map((person) => ({
        userId: person.userId,
        date: dateOnlyToUtcDate(person.dayKey),
      })),
    },
    // Energy only: no notes, symptoms or anything else from the journal.
    select: { userId: true, energy: true },
  });
  for (const row of rows) byUser.set(row.userId, row.energy);
  return byUser;
}

const sharerSelect = {
  name: true,
  timezone: true,
  enableCycleTracking: true,
  lastPeriodDate: true,
  cycleLength: true,
  supportMessage: true,
} as const;

function isSharedLevel(level: CycleShareLevel): level is SharedLevel {
  return (SHARED_LEVELS as readonly CycleShareLevel[]).includes(level);
}

function householdSelect(userId: string) {
  return {
    id: true,
    name: true,
    members: {
      where: { userId: { not: userId } },
      select: { createdAt: true, user: { select: { name: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    },
    cycleStatusShares: {
      where: { userId },
      select: { level: true, coversMembersJoinedBy: true },
    },
  } satisfies Prisma.OrganizationSelect;
}

function toShareHousehold(
  organization: Prisma.OrganizationGetPayload<{ select: ReturnType<typeof householdSelect> }>,
  membersListedAt: Date
): CycleShareHousehold {
  const row = organization.cycleStatusShares[0];
  const share =
    row && isSharedLevel(row.level)
      ? { level: row.level, coversMembersJoinedBy: row.coversMembersJoinedBy }
      : null;
  return {
    id: organization.id,
    name: organization.name,
    share: share && {
      level: share.level,
      coversMembersJoinedBy: share.coversMembersJoinedBy.toISOString(),
    },
    members: organization.members.map((member) => ({
      name: member.user.name,
      seesStatus: share !== null && isCoveredByShare(member.createdAt, share.coversMembersJoinedBy),
    })),
    membersListedAt: membersListedAt.toISOString(),
  };
}

/** The households (only) the user belongs to, oldest membership first, with their shares. */
async function getShareHouseholds(
  userId: string,
  organizationId?: string
): Promise<CycleShareHousehold[]> {
  // Taken before the read: someone who joins while it runs is listed but not covered by a
  // share that uses this time, never the other way round.
  const listedAt = new Date();
  const memberships = await prisma.member.findMany({
    where: {
      userId,
      ...(organizationId && { organizationId }),
      organization: { type: { in: CYCLE_STATUS_ORG_TYPES } },
    },
    select: { organization: { select: householdSelect(userId) } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return memberships.map(({ organization }) => toShareHousehold(organization, listedAt));
}

export type CycleSharingPanelData = {
  /** Decrypted. Shown only in households the user shares Full status with. */
  supportMessage: string | null;
  /** Cycle tracking is on and a last period date is set; sharing shows nothing without both. */
  cycleConfigured: boolean;
  /** The time zone that decides the user's "today" (the profile's, or UTC). */
  timeZone: string;
  /** The user's own data, for the live preview in their own Profile. */
  preview: {
    id: string;
    name: string;
    snapshot: CycleSnapshot | null;
    todayEnergy: number | null;
    timeOfDay: TimeOfDay;
  };
  /** Every household the user belongs to; collectives, communities and workplaces never show it. */
  households: CycleShareHousehold[];
};

export async function getCycleSharingPanelData(
  userId: string,
  now: Date = new Date()
): Promise<CycleSharingPanelData | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: sharerSelect });
  if (!user) return null;

  const timeZone = resolveTimeZone(user.timezone);
  const dayKey = sharerDayKey(user, now);
  const [energy, households] = await Promise.all([
    getTodayEnergyByUser([{ userId, dayKey }]),
    getShareHouseholds(userId),
  ]);

  return {
    supportMessage: decrypt(user.supportMessage),
    cycleConfigured: isCycleConfigured(user),
    timeZone,
    preview: {
      id: userId,
      name: user.name,
      snapshot: cycleSnapshotFor(user, dayKey),
      todayEnergy: energy.get(userId) ?? null,
      // Their own time of day, as a viewer would get it (neutral wording while the zone is unset).
      timeOfDay: timeOfDayIn(user.timezone, now),
    },
    households,
  };
}

/** The level the user shares with one household; NONE when there is no share. */
export async function getCycleShareLevel(
  userId: string,
  organizationId: string
): Promise<CycleShareLevel> {
  const share = await prisma.cycleStatusShare.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    select: { level: true },
  });
  return share?.level ?? 'NONE';
}

export type CycleShareUpdate = {
  household: CycleShareHousehold;
  cycleConfigured: boolean;
  /** The time zone that decides the user's "today", after any device zone was adopted. */
  timeZone: string;
};

/**
 * Start, change or stop sharing with one household (already validated with
 * SetCycleStatusShareSchema). Pass the session user id; the household must be one the user
 * belongs to and of a type that allows it.
 *
 * Starting covers the members who had joined by `membersListedAt` (the page's list), never
 * anyone later. Changing the level keeps who is covered; `includeNewMembers` extends it to the
 * members the page listed. NONE deletes the share.
 */
export async function setCycleStatusShare(
  userId: string,
  input: SetCycleStatusShareInput
): Promise<Result<CycleShareUpdate>> {
  const { organizationId } = input;
  const membership = await prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { organization: { select: { type: true } } },
  });
  if (!membership) return { ok: false, error: NOT_A_HOUSEHOLD_MEMBER_ERROR };
  if (!canShowIndividualCycleStatus(membership.organization.type, { sharerOptedIn: true })) {
    return { ok: false, error: CYCLE_SHARING_HOUSEHOLDS_ONLY_ERROR };
  }
  // A page from the future cannot cover people who have not joined yet.
  const coversMembersJoinedBy = new Date(
    Math.min(Date.parse(input.membersListedAt), Date.now())
  );

  const written = await prisma.$transaction(async (tx) => {
    // Hold the membership until the share is written. A removal or leave running now either
    // waits for this commit and then deletes the share, or has already deleted the membership
    // and this fails, so no share outlives the membership.
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "member"
      WHERE "userId" = ${userId} AND "organizationId" = ${organizationId}
      FOR SHARE`;
    if (locked.length === 0) return false;

    if (input.level === 'NONE') {
      await tx.cycleStatusShare.deleteMany({ where: { userId, organizationId } });
      return true;
    }
    await tx.cycleStatusShare.upsert({
      where: { userId_organizationId: { userId, organizationId } },
      create: {
        id: generateRecordId('css'),
        userId,
        organizationId,
        level: input.level,
        coversMembersJoinedBy,
      },
      // A level change keeps who is covered.
      update: { level: input.level },
    });
    if (input.includeNewMembers) {
      // Only ever widens to the people the page listed; an older page changes nothing.
      await tx.cycleStatusShare.updateMany({
        where: { userId, organizationId, coversMembersJoinedBy: { lt: coversMembersJoinedBy } },
        data: { coversMembersJoinedBy },
      });
    }
    return true;
  });
  if (!written) return { ok: false, error: NOT_A_HOUSEHOLD_MEMBER_ERROR };

  if (input.level !== 'NONE') await adoptDeviceTimeZone(userId, input.deviceTimeZone);

  const [[household], user] = await Promise.all([
    getShareHouseholds(userId, organizationId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { enableCycleTracking: true, lastPeriodDate: true, cycleLength: true, timezone: true },
    }),
  ]);
  if (!household || !user) return { ok: false, error: NOT_A_HOUSEHOLD_MEMBER_ERROR };
  return {
    ok: true,
    data: {
      household,
      cycleConfigured: isCycleConfigured(user),
      timeZone: resolveTimeZone(user.timezone),
    },
  };
}

/**
 * Journal days are filed under the browser's calendar day, and the profile zone defaults to
 * UTC, which most people never change. While it is still the default, the device's zone is
 * saved so that the household's "today" is the sharer's own day. A zone the person typed in
 * Profile is never replaced.
 */
async function adoptDeviceTimeZone(userId: string, deviceTimeZone: string | undefined) {
  if (!deviceTimeZone) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  if (!user) return;
  const adopted = timeZoneToAdopt(user.timezone, deviceTimeZone);
  if (!adopted) return;
  // Only if the profile still has the zone checked above (not one saved in the meantime).
  await prisma.user.updateMany({
    where: { id: userId, timezone: user.timezone },
    data: { timezone: adopted },
  });
}

/** Save or clear the personal message (already validated). Returns it decrypted. */
export async function updateSupportMessage(
  userId: string,
  supportMessage: string | null
): Promise<string | null> {
  const user = await prisma.user.update({
    where: { id: userId },
    // encrypt('') is null, so an empty message clears it.
    data: { supportMessage: encrypt(supportMessage) },
    select: { supportMessage: true },
  });
  return decrypt(user.supportMessage);
}

export type SupportStatusBoard = {
  organization: { id: string; name: string; type: OrganizationType };
  /** False for collectives, communities and workplaces: nothing individual is shown there. */
  sharingAllowed: boolean;
  /** Other people in the organization, whether or not they share. */
  otherMemberCount: number;
  /** Other members who share with the viewer, as projected for this viewer. Never the viewer. */
  statuses: ProjectedCycleStatus[];
};

/**
 * The Support Status board for `viewerId` in `organizationId`. Null when the viewer is not a
 * member. Pass the session user id; never an id from the client.
 */
export async function getSupportStatusBoard(
  viewerId: string,
  organizationId: string,
  now: Date = new Date()
): Promise<SupportStatusBoard | null> {
  const membership = await prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId: viewerId } },
    select: { createdAt: true, organization: { select: { id: true, name: true, type: true } } },
  });
  if (!membership) return null;
  const organization = membership.organization;

  const othersWhere = { organizationId, userId: { not: viewerId } };
  if (!CYCLE_STATUS_ORG_TYPES.includes(organization.type)) {
    return { organization, sharingAllowed: false, otherMemberCount: 0, statuses: [] };
  }

  const [viewer, otherMemberCount, shares] = await Promise.all([
    prisma.user.findUnique({
      where: { id: viewerId },
      select: { focusPreference: true, timezone: true },
    }),
    prisma.member.count({ where: othersWhere }),
    prisma.cycleStatusShare.findMany({
      where: {
        ...othersWhere,
        level: { not: 'NONE' },
        // Only sharers who agreed after the viewer joined, or included them since.
        coversMembersJoinedBy: { gte: membership.createdAt },
        user: {
          enableCycleTracking: true,
          lastPeriodDate: { not: null },
          // Leaving deletes the share; this is the backstop.
          members: { some: { organizationId } },
        },
      },
      select: { userId: true, level: true, user: { select: sharerSelect } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);

  const visible: {
    userId: string;
    level: CycleShareLevel;
    dayKey: string;
    user: (typeof shares)[number]['user'];
  }[] = [];
  for (const { userId, level: storedLevel, user } of shares) {
    const level = getEffectiveShareLevel({
      level: storedLevel,
      cycleConfigured: isCycleConfigured(user),
    });
    // Backstop for the query filter above, and the single policy rule for org types.
    if (!canShowIndividualCycleStatus(organization.type, { sharerOptedIn: level !== 'NONE' })) {
      continue;
    }
    visible.push({ userId, level, dayKey: sharerDayKey(user, now), user });
  }

  const energyByUser = await getTodayEnergyByUser(
    visible
      .filter((sharer) => levelIncludes(sharer.level, 'ENERGY'))
      .map((sharer) => ({ userId: sharer.userId, dayKey: sharer.dayKey }))
  );

  const supportViewer = {
    focus: parseFocusPreference(viewer?.focusPreference),
    // The viewer's own time of day. Someone who only views keeps the default zone (only sharing
    // fills in the device's), so while it is unset the wording is neutral rather than a UTC guess.
    timeOfDay: timeOfDayIn(viewer?.timezone, now),
  };

  const statuses: ProjectedCycleStatus[] = [];
  for (const sharer of visible) {
    const status = projectCycleStatus(
      {
        id: sharer.userId,
        name: sharer.user.name,
        level: sharer.level,
        snapshot: cycleSnapshotFor(sharer.user, sharer.dayKey),
        todayEnergy: energyByUser.get(sharer.userId) ?? null,
        // Decrypted only for people who share it.
        supportMessage: sharer.level === 'FULL' ? decrypt(sharer.user.supportMessage) : null,
      },
      supportViewer
    );
    if (status) statuses.push(status);
  }

  return { organization, sharingAllowed: true, otherMemberCount, statuses };
}
