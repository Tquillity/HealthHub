import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { findButtons } from '@/components/test-markup';
import { CYCLE_PHASES, type BiologicalMatch } from '@/lib/phase-nutrition';
import { PHASE_BADGE_CLASSES } from '@/lib/phase-theme';
import { BiologicalMatchBadge } from './biological-match-badge';

// The palette `@import 'tailwindcss'` builds the app with (src/app/globals.css)
const themeCss = readFileSync(
  join(dirname(createRequire(import.meta.url).resolve('tailwindcss/package.json')), 'theme.css'),
  'utf-8'
);

function oklchOf(color: string): [number, number, number] {
  const match = themeCss.match(
    new RegExp(`--color-${color}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)\\)`)
  );
  if (!match) throw new Error(`No Tailwind color ${color}`);
  return [Number(match[1]) / 100, Number(match[2]), Number(match[3])];
}

/** WCAG relative luminance of an OKLCH color, clipped to sRGB like browsers display it. */
function luminance([lightness, chroma, hue]: [number, number, number]): number {
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((channel) => {
    // Clip in gamma-encoded sRGB, then decode again
    const encoded = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
    const clipped = Math.min(1, Math.max(0, encoded));
    return clipped <= 0.04045 ? clipped / 12.92 : ((clipped + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(oklchOf(foreground)), luminance(oklchOf(background))].sort(
    (x, y) => y - x
  );
  return (light + 0.05) / (dark + 0.05);
}

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
