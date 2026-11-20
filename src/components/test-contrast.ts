import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

/**
 * WCAG contrast of Tailwind colors, for tests. Reads the palette that `@import 'tailwindcss'`
 * builds the app with (src/app/globals.css). Not imported by app code.
 */

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

/** `white`, or a palette color such as `rose-700`. */
function luminanceOf(color: string): number {
  return color === 'white' ? 1 : luminance(oklchOf(color));
}

/** WCAG contrast ratio of two Tailwind colors, e.g. contrast('amber-800', 'amber-50'). */
export function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminanceOf(foreground), luminanceOf(background)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
