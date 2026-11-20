import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEME_COLOR } from '@/lib/site-metadata';

/**
 * Guards the install metadata in public/manifest.json against the files it points at.
 * Rules follow the W3C Web App Manifest spec (https://www.w3.org/TR/appmanifest/) and the
 * Chrome installability criteria (https://web.dev/articles/install-criteria): a 192px and a
 * 512px icon, `display` standalone, and one keyword per `purpose` (Chrome warns that
 * "any maskable" gives too much or too little padding on some platforms).
 */

const root = process.cwd();
const publicDir = path.join(root, 'public');
const appDir = path.join(root, 'src', 'app');

type ManifestIcon = {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
};

type Manifest = {
  id?: string;
  name?: string;
  short_name?: string;
  start_url?: string;
  scope?: string;
  display?: string;
  theme_color?: string;
  background_color?: string;
  icons: ManifestIcon[];
  shortcuts?: { name: string; url: string; icons?: ManifestIcon[] }[];
};

const manifest = JSON.parse(
  readFileSync(path.join(publicDir, 'manifest.json'), 'utf8')
) as Manifest;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Width and height from the PNG IHDR chunk (always the first chunk, at byte 16). */
function readPngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** True when an App Router page renders this path (route groups like `(protected)` are ignored). */
function hasPage(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  const groups = readdirSync(appDir).filter(
    (entry) => entry.startsWith('(') && entry.endsWith(')')
  );
  return ['', ...groups].some((group) =>
    existsSync(path.join(appDir, group, ...segments, 'page.tsx'))
  );
}

const allIcons = [
  ...manifest.icons,
  ...(manifest.shortcuts ?? []).flatMap((shortcut) => shortcut.icons ?? []),
];

describe('public/manifest.json', () => {
  it('has the fields browsers need to install the app', () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    // Launchers truncate longer short names (web.dev recommends 12 characters or fewer).
    expect(manifest.short_name!.length).toBeLessThanOrEqual(12);
    expect(manifest.display).toBe('standalone');
    expect(manifest.id).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('uses the same theme colour as the root layout viewport', () => {
    expect(manifest.theme_color?.toLowerCase()).toBe(THEME_COLOR.toLowerCase());
  });

  it('starts inside its scope on a page that exists', () => {
    expect(manifest.start_url?.startsWith(manifest.scope ?? '/')).toBe(true);
    expect(hasPage(manifest.start_url!)).toBe(true);
  });

  it('points every shortcut at a page that exists', () => {
    for (const shortcut of manifest.shortcuts ?? []) {
      expect(hasPage(shortcut.url), shortcut.url).toBe(true);
    }
  });

  it('declares icon sizes that match the PNG files', () => {
    for (const icon of allIcons) {
      const file = path.join(publicDir, icon.src.replace(/^\//, ''));
      expect(existsSync(file), icon.src).toBe(true);
      expect(icon.type ?? 'image/png').toBe('image/png');
      const { width, height } = readPngSize(file);
      expect(icon.sizes, icon.src).toBe(`${width}x${height}`);
    }
  });

  it('declares one purpose per icon entry', () => {
    for (const icon of manifest.icons) {
      expect(['any', 'maskable', 'monochrome']).toContain(icon.purpose ?? 'any');
    }
  });

  it('provides 192px and 512px icons for both the any and maskable purposes', () => {
    for (const purpose of ['any', 'maskable']) {
      const sizes = manifest.icons
        .filter((icon) => (icon.purpose ?? 'any') === purpose)
        .map((icon) => icon.sizes);
      expect(sizes, purpose).toEqual(expect.arrayContaining(['192x192', '512x512']));
    }
  });
});
