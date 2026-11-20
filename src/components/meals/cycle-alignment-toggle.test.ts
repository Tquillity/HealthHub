import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { findTagById } from '@/components/test-markup';
import { CycleAlignmentToggle } from './cycle-alignment-toggle';

const render = (checked: boolean) =>
  renderToStaticMarkup(
    createElement(CycleAlignmentToggle, {
      options: { canAlign: true, alignByDefault: checked },
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
});
