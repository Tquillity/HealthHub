'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CycleShareLevel } from '@prisma/client';
import { Eye, EyeOff, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SupportStatusItem } from '@/components/household/support-status-item';
import { updateCycleSharing } from '@/actions/support-status-actions';
import {
  CYCLE_SHARE_LEVELS,
  CYCLE_SHARE_LEVEL_INFO,
  getEffectiveShareLevel,
  NEVER_SHARED_NOTE,
  projectCycleStatus,
  SUPPORT_MESSAGE_MAX_LENGTH,
  type UpdateCycleSharingInput,
} from '@/lib/cycle-status-sharing';
import type { CycleSharingPanelData, CycleSharingSettings } from '@/lib/support-status';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';

/**
 * Profile > Cycle status sharing (#3). Off by default. The switch and the level save straight
 * away, so turning sharing off takes effect immediately. The preview runs the same projection
 * as the dashboard widget, so it shows exactly what household members will see.
 */
export function CycleSharingSettingsPanel({ data }: { data: CycleSharingPanelData }) {
  const showToast = useUIStore((state) => state.showToast);
  const [settings, setSettings] = useState<CycleSharingSettings>(data.settings);
  const [draftMessage, setDraftMessage] = useState(data.settings.supportMessage ?? '');
  const [saving, setSaving] = useState(false);

  // From props: saving the profile form above re-renders this with fresh cycle data.
  const cycleConfigured = data.settings.cycleConfigured;
  const savedMessage = settings.supportMessage ?? '';
  const messageDirty = draftMessage.trim() !== savedMessage;

  const save = async (patch: UpdateCycleSharingInput, successMessage: string) => {
    const previous = settings;
    // Show the switch and level change straight away; undo it if saving fails.
    setSettings({
      ...settings,
      ...(patch.shareCycleStatus !== undefined && { shareCycleStatus: patch.shareCycleStatus }),
      ...(patch.shareCycleLevel !== undefined && { shareCycleLevel: patch.shareCycleLevel }),
    });
    setSaving(true);
    const result = await updateCycleSharing(patch);
    setSaving(false);
    if (result.success && result.data) {
      setSettings(result.data);
      if (patch.supportMessage !== undefined) setDraftMessage(result.data.supportMessage ?? '');
      showToast(successMessage, 'success');
    } else {
      setSettings(previous);
      showToast(result.error || 'Could not update sharing', 'error');
    }
  };

  const handleToggle = (on: boolean) => {
    // Turning sharing on starts at the least revealing level that shows anything.
    const patch: UpdateCycleSharingInput = on
      ? {
          shareCycleStatus: true,
          ...(settings.shareCycleLevel === 'NONE' && { shareCycleLevel: 'PHASE' as const }),
        }
      : { shareCycleStatus: false };
    void save(
      patch,
      on ? 'Your household can now see your cycle status.' : 'Your cycle status is private again.'
    );
  };

  const handleLevel = (level: CycleShareLevel) => {
    void save({ shareCycleLevel: level }, `Sharing level: ${CYCLE_SHARE_LEVEL_INFO[level].label}.`);
  };

  const preview = projectCycleStatus(
    {
      id: data.preview.id,
      name: data.preview.name,
      level: getEffectiveShareLevel({ ...settings, cycleConfigured }),
      snapshot: data.preview.snapshot,
      todayEnergy: data.preview.todayEnergy,
      supportMessage: draftMessage,
    },
    // Each member gets ideas that fit their own focus; "both" is the neutral example.
    { focus: 'both', timeOfDay: data.preview.timeOfDay }
  );

  const audience = data.households.filter((household) => household.otherMemberCount > 0);

  return (
    <div className="flex flex-col gap-6">
      {!cycleConfigured && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Nothing is shared until cycle tracking is on and your last period start date is
          saved under Cycle Tracking above.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            role="switch"
            id="cycle-share-enabled"
            checked={settings.shareCycleStatus}
            disabled={saving}
            aria-describedby="cycle-share-enabled-help"
            onChange={(event) => handleToggle(event.target.checked)}
            className="h-5 w-5 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-600"
          />
          <label
            htmlFor="cycle-share-enabled"
            className="flex min-h-[44px] items-center text-sm font-medium text-gray-900"
          >
            Share my cycle status with my household
          </label>
        </div>
        <p id="cycle-share-enabled-help" className="text-sm text-gray-600">
          {audience.length > 0
            ? `Seen by the other members of ${audience.map((household) => household.name).join(', ')}. Never shown in collectives, communities or workplaces.`
            : 'You are not in a household with anyone else yet. Only households can see this, never collectives, communities or workplaces.'}{' '}
          Turn it off at any time and it disappears straight away.
        </p>
        {audience.length === 0 && (
          <Link
            href="/profile/household"
            className="flex min-h-[44px] items-center self-start text-sm font-medium text-primary-600 hover:underline"
          >
            Invite someone to your household
          </Link>
        )}
      </div>

      <fieldset
        disabled={!settings.shareCycleStatus || saving}
        className="flex flex-col gap-3 disabled:opacity-60"
      >
        <legend className="mb-2 text-sm font-medium text-gray-900">How much to share</legend>
        {CYCLE_SHARE_LEVELS.map((level, index) => {
          const info = CYCLE_SHARE_LEVEL_INFO[level];
          const checked = settings.shareCycleLevel === level;
          return (
            <label
              key={level}
              htmlFor={`cycle-share-level-${index}`}
              className={cn(
                'flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                checked ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
              )}
            >
              <input
                type="radio"
                id={`cycle-share-level-${index}`}
                name="cycle-share-level"
                value={level}
                checked={checked}
                onChange={() => handleLevel(level)}
                className="mt-1 h-4 w-4 shrink-0 text-primary-600 focus:ring-2 focus:ring-primary-600"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-gray-900">{info.label}</span>
                <span className="text-sm text-gray-600">{info.description}</span>
              </span>
            </label>
          );
        })}
        <p className="text-xs text-gray-500">{NEVER_SHARED_NOTE}</p>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="cycle-support-message" className="text-sm font-medium text-gray-900">
          Message for your household (optional)
        </label>
        <textarea
          id="cycle-support-message"
          value={draftMessage}
          maxLength={SUPPORT_MESSAGE_MAX_LENGTH}
          rows={3}
          disabled={saving}
          aria-describedby="cycle-support-message-help"
          onChange={(event) => setDraftMessage(event.target.value)}
          placeholder="For example: A quiet evening and a cup of tea would mean a lot this week."
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:opacity-60"
        />
        <p id="cycle-support-message-help" className="text-xs text-gray-500">
          Shown only with Full status. Stored encrypted. {draftMessage.length}/
          {SUPPORT_MESSAGE_MAX_LENGTH} characters.
        </p>
        <div className="flex flex-wrap items-center gap-6">
          <Button
            type="button"
            size="sm"
            disabled={saving || !messageDirty}
            onClick={() =>
              void save({ supportMessage: draftMessage }, 'Your message is saved.')
            }
          >
            Save message
          </Button>
          {savedMessage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => void save({ supportMessage: null }, 'Your message is removed.')}
            >
              Remove message
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-dashed border-gray-300 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          {preview ? (
            <Eye className="h-4 w-4 text-primary-600" aria-hidden />
          ) : (
            <EyeOff className="h-4 w-4 text-gray-500" aria-hidden />
          )}
          What your household sees
          {preview && messageDirty && preview.level === 'FULL' && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Message not saved yet
            </span>
          )}
        </h3>
        <div aria-live="polite">
          {preview ? (
            <SupportStatusItem status={preview} />
          ) : (
            <p className="text-sm text-gray-600">
              Nothing. Household members see nothing about your cycle.
            </p>
          )}
        </div>
        {preview && (
          <p className="text-xs text-gray-500">
            Each person sees an idea that fits their own focus and time of day, so the wording
            can differ a little.
          </p>
        )}
      </div>
    </div>
  );
}
