import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { findTagById } from '@/components/test-markup';
import { CycleAlignmentToggle } from './cycle-alignment-toggle';

const render = (
  checked: boolean,
  options: { canAlign: boolean; cycleLongerThanUsual: boolean } = {
    canAlign: true,
    cycleLongerThanUsual: false,
  }
) =>
  renderToStaticMarkup(
    createElement(CycleAlignmentToggle, {
      options: { ...options, alignByDefault: checked },
      checked,
      onCheckedChange: () => {},
    })
  );

describe('CycleAlignmentToggle', () => {
  it('says next to the switch that other members see the planned meals', () => {
    const html = render(false);
    expect(findTagById(html, 'meal-plan-align-cycle-visibility')).toBeDefined();
    expect(html).toContain('Other members of this space can see the planned meals');
    // Screen readers hear it with the switch
    expect(findTagById(html, 'meal-plan-align-cycle')).toContain(
      'aria-describedby="meal-plan-align-cycle-hint meal-plan-align-cycle-visibility"'
    );
  });

  it('is off unless the saved choice turned it on', () => {
    expect(findTagById(render(false), 'meal-plan-align-cycle')).not.toMatch(/\schecked=""/);
    expect(findTagById(render(true), 'meal-plan-align-cycle')).toMatch(/\schecked=""/);
  });

  it('makes the whole 44px row the label of the switch', () => {
    const html = render(false);
    expect(html).toMatch(
      /<label class="flex min-h-\[44px\][^"]*"><input[^>]*id="meal-plan-align-cycle"[^>]*>Align with cycle phase<\/label>/
    );
  });

  it('says why it is off while the cycle is longer than usual, and points to the cycle page', () => {
    const html = render(true, { canAlign: false, cycleLongerThanUsual: true });
    expect(findTagById(html, 'meal-plan-align-cycle')).toMatch(/\sdisabled=""/);
    expect(findTagById(html, 'meal-plan-align-cycle')).not.toMatch(/\schecked=""/);
    expect(html).toContain('Your cycle is longer than usual right now');
    expect(html).toContain('href="/cycle"');
    expect(html).not.toContain('Add your last period start date');
  });
});
