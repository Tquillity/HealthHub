import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { findButtons } from '@/components/test-markup';

vi.mock('@/actions/circadian-actions', () => ({
  deleteAllTimeOfDayEnergy: vi.fn(),
  updateCircadianPreferences: vi.fn(),
}));

import {
  CircadianSettingsControls,
  DeleteCheckInsConfirmation,
} from './circadian-settings-controls';

const settings = {
  enabled: true,
  timeZone: 'Europe/Stockholm',
  timeZoneValid: true,
  loggedDays: 10,
};

const render = (loggedDays: number) =>
  renderToStaticMarkup(
    createElement(CircadianSettingsControls, {
      settings: { ...settings, loggedDays },
    })
  );

describe('CircadianSettingsControls', () => {
  it('announces results in a status region', () => {
    expect(render(10)).toMatch(/<p role="status" class="sr-only"><\/p>/);
  });

  it('keeps the delete button focusable once there is nothing to delete', () => {
    // Focus returns to this button after deleting; a disabled one would drop it.
    const [trigger] = findButtons(render(0));
    expect(trigger.text).toBe('Delete all energy check-ins (0 days)');
    expect(trigger.disabled).toBe(false);
    expect(trigger.attributes).toContain('aria-disabled="true"');

    const [active] = findButtons(render(10));
    expect(active.text).toBe('Delete all energy check-ins (10 days)');
    expect(active.attributes).not.toContain('aria-disabled="');
  });

  it('marks the opt-in checkbox busy with aria-disabled, not disabled', () => {
    const checkbox = render(10).match(/<input[^>]*type="checkbox"[^>]*>/)?.[0];
    expect(checkbox).toContain('aria-disabled:opacity-50');
    expect(checkbox).not.toMatch(/\sdisabled=""/);
  });
});

describe('DeleteCheckInsConfirmation', () => {
  const render = (deleting: boolean) =>
    renderToStaticMarkup(
      createElement(DeleteCheckInsConfirmation, {
        loggedDays: 10,
        deleting,
        onCancel: () => {},
        onConfirm: () => {},
      })
    );

  it('is a group named by its warning, so it is read out when focus moves in', () => {
    const html = render(false);
    const id = html.match(/role="group" aria-labelledby="([^"]+)"/)?.[1];
    expect(id).toBeDefined();
    expect(html).toMatch(
      new RegExp(
        `<p id="${id}"[^>]*>This clears morning, afternoon and evening energy`
      )
    );
    expect(html).toContain('It affects 10 days.');
  });

  it('keeps Cancel and Delete focusable while deleting', () => {
    const buttons = findButtons(render(true));
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Deleting…']);
    for (const button of buttons) {
      expect(button.disabled).toBe(false);
      expect(button.attributes).toContain('aria-disabled="true"');
    }
  });
});
