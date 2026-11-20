import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { findButtons, findTagById } from '@/components/test-markup';
import { projectCycleStatus, type CycleShareHousehold } from '@/lib/cycle-status-sharing';
import type { CycleSharingPanelData } from '@/lib/support-status';

const actions = vi.hoisted(() => ({
  setCycleStatusSharing: vi.fn(),
  saveSupportMessage: vi.fn(),
}));
vi.mock('@/actions/support-status-actions', () => actions);

import { CycleSharingSettingsPanel, HouseholdShareFields } from './cycle-sharing-settings';

const household: CycleShareHousehold = {
  id: 'org_home',
  name: 'Our home',
  share: { level: 'FULL', coversMembersJoinedBy: '2026-11-01T00:00:00.000Z' },
  members: [
    { name: 'Robin Partner', seesStatus: true },
    { name: 'Carol Later', seesStatus: false },
  ],
  listedMembersJoinedBy: '2026-11-20T10:00:00.000Z',
};

const previewSource = {
  id: 'user_me',
  name: 'Mia Me',
  snapshot: { phase: 'luteal' as const, cycleDay: 20, daysUntilNextPeriod: 9 },
  todayEnergy: 6,
  timeOfDay: 'morning' as const,
};

const draft = 'Back rubs welcome, typed but not saved';

const panelData: CycleSharingPanelData = {
  supportMessage: 'Tea, please',
  cycleConfigured: true,
  timeZone: 'Europe/Stockholm',
  preview: previewSource,
  households: [household],
};

const renderFields = (saving: boolean) =>
  renderToStaticMarkup(
    createElement(HouseholdShareFields, {
      household,
      index: 0,
      level: 'FULL',
      saving,
      preview: projectCycleStatus(
        { ...previewSource, level: 'FULL', supportMessage: draft },
        { focus: 'both', timeOfDay: 'morning' }
      ),
      messageDirty: true,
      status: '',
      onLevelChange: () => {},
      onIncludeNewMembers: () => {},
    })
  );

const radioTags = (html: string) => [...html.matchAll(/<input[^>]*type="radio"[^>]*>/g)].map(([tag]) => tag);

describe('HouseholdShareFields', () => {
  it('keeps the switch, levels and include button focusable while saving', () => {
    const html = renderFields(true);
    const toggle = findTagById(html, 'cycle-share-0-enabled');
    expect(toggle).toBeDefined();
    expect(toggle).not.toMatch(/\sdisabled=""/);
    expect(toggle).toContain('aria-disabled="true"');
    expect(html).not.toMatch(/<fieldset[^>]*\sdisabled=""/);
    const radios = radioTags(html);
    expect(radios).toHaveLength(3);
    for (const radio of radios) {
      expect(radio).not.toMatch(/\sdisabled=""/);
      expect(radio).toContain('aria-disabled="true"');
    }
    const include = findButtons(html).find((button) => button.text === 'Share with Carol Later too');
    expect(include).toBeDefined();
    expect(include?.disabled).toBe(false);
    expect(include?.attributes).toContain('aria-disabled="true"');
  });

  it('marks nothing as busy when no save is running', () => {
    const html = renderFields(false);
    expect(html).not.toContain('aria-disabled="');
    expect(html).not.toMatch(/\sdisabled=""/);
  });

  it('keeps the preview out of any live region, and announces saves separately', () => {
    const html = renderFields(false);
    // The draft message shows in the preview, but is never read out while typing.
    expect(html).toContain(draft);
    expect(html).not.toContain('aria-live');
    const status = html.match(/<p role="status"[^>]*>([\s\S]*?)<\/p>/);
    expect(status).not.toBeNull();
    expect(status?.[1]).toBe('');
  });

  it('names who sees it and who joined later', () => {
    const html = renderFields(false);
    expect(html).toContain('Seen by Robin Partner.');
    expect(html).toContain('Carol Later joined after you started sharing and sees nothing.');
  });
});

describe('CycleSharingSettingsPanel preview', () => {
  it('shows what the household sees while the cycle is longer than usual: no phase, not nothing', () => {
    const html = renderToStaticMarkup(
      createElement(CycleSharingSettingsPanel, {
        data: { ...panelData, preview: { ...previewSource, snapshot: { phase: null } } },
      })
    ).replace(/&#x27;/g, "'");
    expect(html).toContain('What Our home sees');
    expect(html).not.toContain('Nothing. They see nothing about your cycle.');
    const preview = html.match(/<article[^>]*>[\s\S]*?<\/article>/)?.[0] ?? '';
    expect(preview).toContain('aria-label="Mia, No phase shown"');
    expect(preview).toContain("Mia's cycle is longer than usual right now, so no phase is shown.");
    expect(preview).toContain('Tea, please');
    expect(preview).not.toMatch(/Day \d|Next period|Typical energy|luteal/i);
  });
});

describe('CycleSharingSettingsPanel', () => {
  const html = renderToStaticMarkup(createElement(CycleSharingSettingsPanel, { data: panelData }));

  it('keeps the message box and its buttons focusable', () => {
    const box = findTagById(html, 'cycle-support-message');
    expect(box).toBeDefined();
    expect(box).not.toMatch(/\sdisabled=""/);
    const save = findButtons(html).find((button) => button.text === 'Save message');
    // Nothing to save yet: marked, not disabled, so focus never drops after a save.
    expect(save?.disabled).toBe(false);
    expect(save?.attributes).toContain('aria-disabled="true"');
    const remove = findButtons(html).find((button) => button.text === 'Remove message');
    expect(remove?.disabled).toBe(false);
  });

  it('has no live region around the preview and one status region per save target', () => {
    expect(html).not.toContain('aria-live');
    expect(html.match(/role="status"/g)).toHaveLength(2);
    expect(html).toContain('Tea, please');
  });

  it('says which time zone decides the sharer’s day', () => {
    expect(html).toContain('your day in Europe/Stockholm');
  });
});
