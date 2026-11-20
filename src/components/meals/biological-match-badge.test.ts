import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { contrast } from '@/components/test-contrast';
import { findButtons } from '@/components/test-markup';
import { CYCLE_PHASES, type BiologicalMatch } from '@/lib/phase-nutrition';
import { PHASE_BADGE_CLASSES } from '@/lib/phase-theme';
import { BiologicalMatchBadge } from './biological-match-badge';

const matchFor = (phase: BiologicalMatch['phase']): BiologicalMatch => ({
  phase,
  nutrients: ['iron'],
  strength: 1,
});

const render = (phase: BiologicalMatch['phase']) =>
  renderToStaticMarkup(
    createElement(BiologicalMatchBadge, { match: matchFor(phase), id: `bio-${phase}` })
  );

describe('BiologicalMatchBadge', () => {
  it('computes contrast like the WCAG reference values', () => {
    // amber-600 on amber-100 was reported at about 2.9:1, indigo-600 on indigo-100 at 5.2:1
    expect(contrast('amber-600', 'amber-100')).toBeCloseTo(2.87, 1);
    expect(contrast('indigo-600', 'indigo-100')).toBeCloseTo(5.23, 1);
  });

  it.each(CYCLE_PHASES)('has 10px text that meets WCAG AA (4.5:1) for the %s phase', (phase) => {
    const classes = PHASE_BADGE_CLASSES[phase];
    const text = classes.match(/\btext-([a-z]+-\d+)\b/)?.[1];
    const background = classes.match(/\bbg-([a-z]+-\d+)\b/)?.[1];
    expect(text && background).toBeTruthy();
    expect(contrast(text!, background!)).toBeGreaterThanOrEqual(4.5);

    const [button] = findButtons(render(phase));
    for (const className of classes.split(' ')) {
      expect(button.attributes).toContain(className);
    }
  });

  it('shows the tooltip from state only, so Escape can close it during hover or focus', () => {
    const html = render('ovulation');
    // CSS that shows it on hover or focus whatever the state is cannot be dismissed
    expect(html).not.toMatch(/peer-hover|peer-focus|group-hover/);
    const [button] = findButtons(html);
    expect(button.ariaLabel).toBe('Biological Match: ovulation phase');
    expect(button.attributes).toContain('aria-describedby="bio-ovulation-tooltip"');
    expect(button.attributes).toContain('aria-expanded="false"');
    // Rendered in a portal on the client, outside the calendar's scroll container
    expect(html).not.toContain('role="tooltip"');
  });
});
