import type { CycleShareLevel, OrganizationType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/encryption';
import { calculateCyclePhase } from '@/lib/cycle-calculator';
import { dateOnlyToUtcDate } from '@/lib/date-only';
import { getMembershipIn } from '@/lib/active-organization';
import { canShowIndividualCycleStatus, CYCLE_STATUS_ORG_TYPES } from '@/lib/org-policy';
import {
  getEffectiveShareLevel,
  getTimeOfDay,
  levelIncludes,
  parseFocusPreference,
  projectCycleStatus,
  toCycleSnapshot,
  type CycleSnapshot,
  type ProjectedCycleStatus,
  type TimeOfDay,
  type UpdateCycleSharingInput,
} from '@/lib/cycle-status-sharing';
import { getLocalDateKey, getLocalHour, resolveTimeZone } from '@/lib/time-zone';

/**
 * Partner sync (issue #3), server side. Reads and writes the sharing settings and builds the
 * Support Status board for one viewer and one organization.
 *
 * Every check happens here, on the server: the viewer must be a member, the organization must
 * be a household (org-policy), and each sharer must still be a member and have opted in. Only
 * the fields chosen by projectCycleStatus leave this module. People who did not opt in are
 * filtered out in the query itself, so their cycle data is never even loaded.
 */

type CycleFields = {
  enableCycleTracking: boolean;
  lastPeriodDate: Date | null;
  cycleLength: number;
};

function isCycleConfigured(user: CycleFields): boolean {
  return user.enableCycleTracking && user.lastPeriodDate !== null;
}

function cycleSnapshotFor(user: CycleFields): CycleSnapshot | null {
  if (!user.enableCycleTracking || !user.lastPeriodDate) return null;
  const cycleLength = user.cycleLength || 28;
  return toCycleSnapshot(calculateCyclePhase(user.lastPeriodDate, cycleLength), cycleLength);
}

/** Today's self-logged journal energy per user, each on their own calendar day. */
async function getTodayEnergyByUser(
  people: { userId: string; timeZone: string | null }[],
  now: Date
): Promise<Map<string, number | null>> {
  const byUser = new Map<string, number | null>();
  if (people.length === 0) return byUser;
  const rows = await prisma.journalEntry.findMany({
    where: {
      OR: people.map((person) => ({
        userId: person.userId,
        date: dateOnlyToUtcDate(getLocalDateKey(now, resolveTimeZone(person.timeZone))),
      })),
    },
    // Energy only: no notes, symptoms or anything else from the journal.
    select: { userId: true, energy: true },
  });
  for (const row of rows) byUser.set(row.userId, row.energy);
  return byUser;
}

const settingsSelect = {
  name: true,
  timezone: true,
  enableCycleTracking: true,
  lastPeriodDate: true,
  cycleLength: true,
  shareCycleStatus: true,
  shareCycleLevel: true,
  supportMessage: true,
} as const;

export type CycleSharingSettings = {
  shareCycleStatus: boolean;
  shareCycleLevel: CycleShareLevel;
  /** Decrypted. */
  supportMessage: string | null;
  /** Cycle tracking is on and a last period date is set; sharing needs both. */
  cycleConfigured: boolean;
  effectiveLevel: CycleShareLevel;
};

function toSettings(user: {
  shareCycleStatus: boolean;
  shareCycleLevel: CycleShareLevel;
  supportMessage: string | null;
} & CycleFields): CycleSharingSettings {
  const cycleConfigured = isCycleConfigured(user);
  return {
    shareCycleStatus: user.shareCycleStatus,
    shareCycleLevel: user.shareCycleLevel,
    supportMessage: decrypt(user.supportMessage),
    cycleConfigured,
    effectiveLevel: getEffectiveShareLevel({ ...user, cycleConfigured }),
  };
}

export async function getCycleSharingSettings(
  userId: string
): Promise<CycleSharingSettings | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: settingsSelect });
  return user ? toSettings(user) : null;
}

/** Saves only the fields in `input` (already validated with UpdateCycleSharingSchema). */
export async function updateCycleSharingSettings(
  userId: string,
  input: UpdateCycleSharingInput
): Promise<CycleSharingSettings> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.shareCycleStatus !== undefined && { shareCycleStatus: input.shareCycleStatus }),
      ...(input.shareCycleLevel !== undefined && { shareCycleLevel: input.shareCycleLevel }),
      // encrypt('') is null, so an empty message clears it.
      ...(input.supportMessage !== undefined && { supportMessage: encrypt(input.supportMessage) }),
    },
    select: settingsSelect,
  });
  return toSettings(user);
}

export type CycleSharingPanelData = {
  settings: CycleSharingSettings;
  /** The user's own data, for the live preview in their own Profile. */
  preview: {
    id: string;
    name: string;
    snapshot: CycleSnapshot | null;
    todayEnergy: number | null;
    timeOfDay: TimeOfDay;
  };
  /** Households whose other members would see the status. */
  households: { id: string; name: string; otherMemberCount: number }[];
};

export async function getCycleSharingPanelData(
  userId: string,
  now: Date = new Date()
): Promise<CycleSharingPanelData | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: settingsSelect });
  if (!user) return null;

  const timeZone = resolveTimeZone(user.timezone);
  const [energy, memberships] = await Promise.all([
    getTodayEnergyByUser([{ userId, timeZone }], now),
    prisma.member.findMany({
      where: { userId, organization: { type: { in: CYCLE_STATUS_ORG_TYPES } } },
      select: {
        organization: {
          select: { id: true, name: true, _count: { select: { members: true } } },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);

  const households = new Map<string, CycleSharingPanelData['households'][number]>();
  for (const { organization } of memberships) {
    households.set(organization.id, {
      id: organization.id,
      name: organization.name,
      otherMemberCount: Math.max(0, organization._count.members - 1),
    });
  }

  return {
    settings: toSettings(user),
    preview: {
      id: userId,
      name: user.name,
      snapshot: cycleSnapshotFor(user),
      todayEnergy: energy.get(userId) ?? null,
      timeOfDay: getTimeOfDay(getLocalHour(now, timeZone)),
    },
    households: [...households.values()],
  };
}

export type SupportStatusBoard = {
  organization: { id: string; name: string; type: OrganizationType };
  /** False for collectives, communities and workplaces: nothing individual is shown there. */
  sharingAllowed: boolean;
  /** Other people in the organization, whether or not they share. */
  otherMemberCount: number;
  /** Other members who opted in, as projected for this viewer. Never the viewer. */
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
  const membership = await getMembershipIn(viewerId, organizationId);
  if (!membership) return null;
  const organization = membership.organization;

  const othersWhere = { organizationId, userId: { not: viewerId } };
  if (!CYCLE_STATUS_ORG_TYPES.includes(organization.type)) {
    return { organization, sharingAllowed: false, otherMemberCount: 0, statuses: [] };
  }

  const [viewer, otherMemberCount, sharers] = await Promise.all([
    prisma.user.findUnique({
      where: { id: viewerId },
      select: { focusPreference: true, timezone: true },
    }),
    prisma.member.count({ where: othersWhere }),
    prisma.member.findMany({
      where: {
        ...othersWhere,
        // Opted in with a real level and cycle tracking set up; nobody else is loaded.
        user: {
          shareCycleStatus: true,
          shareCycleLevel: { not: 'NONE' },
          enableCycleTracking: true,
          lastPeriodDate: { not: null },
        },
      },
      select: { userId: true, user: { select: settingsSelect } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);

  const seen = new Set<string>();
  const visible: { userId: string; level: CycleShareLevel; user: (typeof sharers)[number]['user'] }[] =
    [];
  for (const { userId, user } of sharers) {
    if (seen.has(userId)) continue;
    seen.add(userId);
    const level = getEffectiveShareLevel({
      shareCycleStatus: user.shareCycleStatus,
      shareCycleLevel: user.shareCycleLevel,
      cycleConfigured: isCycleConfigured(user),
    });
    // Backstop for the query filter above, and the single policy rule for org types.
    if (!canShowIndividualCycleStatus(organization.type, { sharerOptedIn: level !== 'NONE' })) {
      continue;
    }
    visible.push({ userId, level, user });
  }

  const energyByUser = await getTodayEnergyByUser(
    visible
      .filter((sharer) => levelIncludes(sharer.level, 'ENERGY'))
      .map((sharer) => ({ userId: sharer.userId, timeZone: sharer.user.timezone })),
    now
  );

  const supportViewer = {
    focus: parseFocusPreference(viewer?.focusPreference),
    timeOfDay: getTimeOfDay(getLocalHour(now, resolveTimeZone(viewer?.timezone))),
  };

  const statuses: ProjectedCycleStatus[] = [];
  for (const sharer of visible) {
    const status = projectCycleStatus(
      {
        id: sharer.userId,
        name: sharer.user.name,
        level: sharer.level,
        snapshot: cycleSnapshotFor(sharer.user),
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
