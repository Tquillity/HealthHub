'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CycleShareLevel } from '@prisma/client';
import { Eye, EyeOff, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SupportStatusItem } from '@/components/household/support-status-item';
import { saveSupportMessage, setCycleStatusSharing } from '@/actions/support-status-actions';
import {
  CYCLE_SHARE_LEVEL_INFO,
  describeAudience,
  getEffectiveShareLevel,
  listNames,
  membersNotYetIncluded,
  NEVER_SHARED_NOTE,
  projectCycleStatus,
  SHARED_LEVELS,
  SUPPORT_MESSAGE_MAX_LENGTH,
  type CycleShareHousehold,
  type ProjectedCycleStatus,
} from '@/lib/cycle-status-sharing';
import type { CycleSharingPanelData } from '@/lib/support-status';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';

type HouseholdShareFieldsProps = {
  household: CycleShareHousehold;
  /** Position in the list, for unique ids. */
  index: number;
  /** The level shown: the saved one, or the one being saved. NONE when not shared. */
  level: CycleShareLevel;
  saving: boolean;
  preview: ProjectedCycleStatus | null;
  /** The message in the box differs from the saved one (shown in a Full preview). */
  messageDirty: boolean;
  onLevelChange: (level: CycleShareLevel) => void;
  onIncludeNewMembers: () => void;
};

/** One household's switch, level, audience and preview. No state of its own. */
export function HouseholdShareFields({
  household,
  index,
  level,
  saving,
  preview,
  messageDirty,
  onLevelChange,
  onIncludeNewMembers,
}: HouseholdShareFieldsProps) {
  const prefix = `cycle-share-${index}`;
  const on = level !== 'NONE';
  const newMembers = membersNotYetIncluded(household);

  return (
    <section
      aria-labelledby={`${prefix}-title`}
      className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4"
    >
      <h3 id={`${prefix}-title`} className="text-base font-semibold text-gray-900">
        {household.name}
      </h3>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            role="switch"
            id={`${prefix}-enabled`}
            checked={on}
            disabled={saving}
            aria-describedby={`${prefix}-audience`}
            onChange={(event) => onLevelChange(event.target.checked ? 'PHASE' : 'NONE')}
            className="h-5 w-5 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-2 focus:ring-primary-600"
          />
          <label
            htmlFor={`${prefix}-enabled`}
            className="flex min-h-[44px] items-center text-sm font-medium text-gray-900"
          >
            Share my cycle status with {household.name}
          </label>
        </div>
        <p id={`${prefix}-audience`} className="text-sm text-gray-600">
          {describeAudience(household)}
        </p>
      </div>

      {on && newMembers.length > 0 && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-900">
            {listNames(newMembers)} joined after you started sharing and {newMembers.length === 1 ? 'sees' : 'see'}{' '}
            nothing.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={onIncludeNewMembers}
          >
            Share with {listNames(newMembers)} too
          </Button>
        </div>
      )}

      {on && (
        <fieldset disabled={saving} className="flex flex-col gap-3 disabled:opacity-60">
          <legend className="mb-2 text-sm font-medium text-gray-900">
            How much {household.name} sees
          </legend>
          {SHARED_LEVELS.map((option, optionIndex) => {
            const info = CYCLE_SHARE_LEVEL_INFO[option];
            const checked = level === option;
            const id = `${prefix}-level-${optionIndex}`;
            return (
              <label
                key={option}
                htmlFor={id}
                className={cn(
                  'flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                  checked ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                )}
              >
                <input
                  type="radio"
                  id={id}
                  name={`${prefix}-level`}
                  value={option}
                  checked={checked}
                  onChange={() => onLevelChange(option)}
                  className="mt-1 h-4 w-4 shrink-0 text-primary-600 focus:ring-2 focus:ring-primary-600"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-gray-900">{info.label}</span>
                  <span className="text-sm text-gray-600">{info.description}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-dashed border-gray-300 p-4">
        <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
          {preview ? (
            <Eye className="h-4 w-4 text-primary-600" aria-hidden />
          ) : (
            <EyeOff className="h-4 w-4 text-gray-500" aria-hidden />
          )}
          What {household.name} sees
          {preview && messageDirty && preview.level === 'FULL' && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Message not saved yet
            </span>
          )}
        </h4>
        <div aria-live="polite">
          {preview ? (
            <SupportStatusItem status={preview} />
          ) : (
            <p className="text-sm text-gray-600">Nothing. They see nothing about your cycle.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function HouseholdShareCard({
  initialHousehold,
  index,
  cycleConfigured,
  previewSource,
  draftMessage,
  messageDirty,
}: {
  initialHousehold: CycleShareHousehold;
  index: number;
  cycleConfigured: boolean;
  previewSource: CycleSharingPanelData['preview'];
  draftMessage: string;
  messageDirty: boolean;
}) {
  const showToast = useUIStore((state) => state.showToast);
  const [household, setHousehold] = useState(initialHousehold);
  // Shown straight away while saving; cleared (back to the saved level) when the save ends.
  const [pendingLevel, setPendingLevel] = useState<CycleShareLevel | null>(null);
  const [saving, setSaving] = useState(false);

  const level = pendingLevel ?? household.share?.level ?? 'NONE';

  const save = async (next: CycleShareLevel, includeNewMembers: boolean, successMessage: string) => {
    if (saving) return;
    setPendingLevel(next);
    setSaving(true);
    const result = await setCycleStatusSharing({
      organizationId: household.id,
      level: next,
      membersListedAt: household.membersListedAt,
      ...(includeNewMembers && { includeNewMembers: true }),
    });
    setSaving(false);
    setPendingLevel(null);
    if (result.success && result.data) {
      setHousehold(result.data.household);
      showToast(successMessage, 'success');
    } else {
      showToast(result.error || 'Could not update sharing', 'error');
    }
  };

  const handleLevelChange = (next: CycleShareLevel) => {
    if (next === level) return;
    const message =
      next === 'NONE'
        ? `${household.name} can no longer see your cycle status.`
        : level === 'NONE'
          ? `${household.name} can now see your cycle status.`
          : `Sharing level for ${household.name}: ${CYCLE_SHARE_LEVEL_INFO[next].label}.`;
    void save(next, false, message);
  };

  const preview = projectCycleStatus(
    {
      id: previewSource.id,
      name: previewSource.name,
      level: getEffectiveShareLevel({ level, cycleConfigured }),
      snapshot: previewSource.snapshot,
      todayEnergy: previewSource.todayEnergy,
      supportMessage: draftMessage,
    },
    // Each member gets ideas that fit their own focus; "both" is the neutral example.
    { focus: 'both', timeOfDay: previewSource.timeOfDay }
  );

  return (
    <HouseholdShareFields
      household={household}
      index={index}
      level={level}
      saving={saving}
      preview={preview}
      messageDirty={messageDirty}
      onLevelChange={handleLevelChange}
      onIncludeNewMembers={() =>
        void save(
          level,
          true,
          `${listNames(membersNotYetIncluded(household))} can now see your cycle status too.`
        )
      }
    />
  );
}

/**
 * Profile > Cycle status sharing (#3). Off by default, and chosen per household: each one lists
 * who sees it, and people who join later see nothing until they are included. The switch and
 * level save straight away, so turning sharing off takes effect immediately. The preview runs
 * the same projection as the dashboard widget, so it shows exactly what members will see.
 */
export function CycleSharingSettingsPanel({ data }: { data: CycleSharingPanelData }) {
  const showToast = useUIStore((state) => state.showToast);
  const [savedMessage, setSavedMessage] = useState(data.supportMessage ?? '');
  const [draftMessage, setDraftMessage] = useState(data.supportMessage ?? '');
  const [savingMessage, setSavingMessage] = useState(false);

  // From props: saving the profile form above re-renders this with fresh cycle data.
  const cycleConfigured = data.cycleConfigured;
  const messageDirty = draftMessage.trim() !== savedMessage;

  const saveMessage = async (supportMessage: string | null, successMessage: string) => {
    if (savingMessage) return;
    setSavingMessage(true);
    const result = await saveSupportMessage({ supportMessage });
    setSavingMessage(false);
    if (result.success && result.data) {
      const saved = result.data.supportMessage ?? '';
      setSavedMessage(saved);
      setDraftMessage(saved);
      showToast(successMessage, 'success');
    } else {
      showToast(result.error || 'Could not save your message', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {!cycleConfigured && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Nothing is shared until cycle tracking is on and your last period start date is
          saved under Cycle Tracking above.
        </p>
      )}

      {data.households.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-gray-600">
            You are not in a household yet. Only households can see your cycle status, never
            collectives, communities or workplaces.
          </p>
          <Link
            href="/profile/household"
            className="flex min-h-[44px] items-center self-start text-sm font-medium text-primary-600 hover:underline"
          >
            Go to your household
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            Choose for each household. Only the people listed under it see your status, and
            people who join later see nothing until you include them. Never shown in
            collectives, communities or workplaces. Turn it off at any time and it disappears
            straight away.
          </p>
          <ul className="flex flex-col gap-4">
            {data.households.map((household, index) => (
              <li key={household.id}>
                <HouseholdShareCard
                  initialHousehold={household}
                  index={index}
                  cycleConfigured={cycleConfigured}
                  previewSource={data.preview}
                  draftMessage={draftMessage}
                  messageDirty={messageDirty}
                />
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500">
            {NEVER_SHARED_NOTE} Each person sees an idea that fits their own focus and time of
            day, so the wording can differ a little.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="cycle-support-message" className="text-sm font-medium text-gray-900">
          Message for your household (optional)
        </label>
        <textarea
          id="cycle-support-message"
          value={draftMessage}
          maxLength={SUPPORT_MESSAGE_MAX_LENGTH}
          rows={3}
          disabled={savingMessage}
          aria-describedby="cycle-support-message-help"
          onChange={(event) => setDraftMessage(event.target.value)}
          placeholder="For example: A quiet evening and a cup of tea would mean a lot this week."
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:opacity-60"
        />
        <p id="cycle-support-message-help" className="text-xs text-gray-500">
          Shown only to households that see Full status. Stored encrypted.{' '}
          {draftMessage.length}/{SUPPORT_MESSAGE_MAX_LENGTH} characters.
        </p>
        <div className="flex flex-wrap items-center gap-6">
          <Button
            type="button"
            size="sm"
            disabled={savingMessage || !messageDirty}
            onClick={() => void saveMessage(draftMessage, 'Your message is saved.')}
          >
            Save message
          </Button>
          {savedMessage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingMessage}
              onClick={() => void saveMessage(null, 'Your message is removed.')}
            >
              Remove message
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
