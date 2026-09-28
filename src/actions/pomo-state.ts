'use server';

import { prisma } from '@/lib/db';
import { requireSessionUserId } from '@/lib/session';
import {
  createDefaultPomoStatePayload,
  describePomoPayloadIssue,
  normalizePomoStateForPersist,
  parseStoredPomoPayload,
  PomoStatePayloadSchema,
  type PomoStatePayload,
} from '@/lib/pomo/validation/pomo-state-schema';
import type { LoadedPomoState } from '@/lib/pomo/utils/cloud-hydration';
import { Prisma } from '@prisma/client';

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

async function requirePremiumUserId(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await requireSessionUserId();
  if (!session.ok) {
    return { ok: false, error: 'Unauthorized' };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { isPremium: true },
  });

  if (!user?.isPremium) {
    return { ok: false, error: 'Premium required' };
  }

  return { ok: true, userId: session.userId };
}

export async function getPomoState(): Promise<ActionResult<LoadedPomoState>> {
  try {
    const gate = await requirePremiumUserId();
    if (!gate.ok) {
      return { success: false, error: gate.error };
    }

    const row = await prisma.pomoState.findUnique({
      where: { userId: gate.userId },
      select: { payloadJson: true },
    });

    if (!row) {
      return {
        success: true,
        data: {
          payload: createDefaultPomoStatePayload(),
          source: 'empty',
          migrated: false,
        },
      };
    }

    // A stored row that fails validation is reported, never replaced with defaults:
    // the client would otherwise save those defaults over the user's real data.
    const parsed = parseStoredPomoPayload(row.payloadJson);
    if (!parsed.ok) {
      console.error(
        '[HealthHub action] pomo-state getPomoState: stored payload failed validation'
      );
      return { success: false, error: parsed.error };
    }

    return {
      success: true,
      data: {
        payload: parsed.payload,
        source: 'stored',
        migrated: parsed.migrated,
      },
    };
  } catch (error) {
    console.error('[HealthHub action] pomo-state getPomoState:', error);
    return { success: false, error: 'Failed to load timer state' };
  }
}

export async function savePomoState(
  payload: unknown
): Promise<ActionResult<{ updatedAt: string }>> {
  try {
    const gate = await requirePremiumUserId();
    if (!gate.ok) {
      return { success: false, error: gate.error };
    }

    const validated = PomoStatePayloadSchema.safeParse(payload);
    if (!validated.success) {
      return {
        success: false,
        error: describePomoPayloadIssue(validated.error),
      };
    }

    const normalized = normalizePomoStateForPersist(validated.data);

    const row = await prisma.pomoState.upsert({
      where: { userId: gate.userId },
      create: {
        userId: gate.userId,
        payloadJson: normalized as Prisma.InputJsonValue,
      },
      update: {
        payloadJson: normalized as Prisma.InputJsonValue,
      },
      select: { updatedAt: true },
    });

    return { success: true, data: { updatedAt: row.updatedAt.toISOString() } };
  } catch (error) {
    console.error('[HealthHub action] pomo-state savePomoState:', error);
    return { success: false, error: 'Failed to save timer state' };
  }
}

/** Dashboard server read — premium flag + payload without exposing action errors to guests. */
export async function getPremiumPomoDashboardSnapshot(): Promise<{
  isPremium: boolean;
  payload: PomoStatePayload | null;
}> {
  try {
    const session = await requireSessionUserId();
    if (!session.ok) {
      return { isPremium: false, payload: null };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { isPremium: true },
    });

    if (!user?.isPremium) {
      return { isPremium: false, payload: null };
    }

    const row = await prisma.pomoState.findUnique({
      where: { userId: session.userId },
      select: { payloadJson: true },
    });

    if (!row) {
      return { isPremium: true, payload: createDefaultPomoStatePayload() };
    }

    const parsed = parseStoredPomoPayload(row.payloadJson);
    return { isPremium: true, payload: parsed.ok ? parsed.payload : null };
  } catch (error) {
    console.error(
      '[HealthHub action] pomo-state getPremiumPomoDashboardSnapshot:',
      error
    );
    return { isPremium: false, payload: null };
  }
}
