import { describe, expect, it, vi } from 'vitest';
import {
  getRevealMode,
  readMotionEnvironment,
  runInViewTransition,
} from '@/lib/view-transitions';

const matchMedia = (reduce: boolean) =>
  vi.fn((query: string) => ({
    matches: reduce && query === '(prefers-reduced-motion: reduce)',
  }));

describe('readMotionEnvironment', () => {
  it('detects startViewTransition and reduced motion', () => {
    expect(
      readMotionEnvironment(
        { startViewTransition: () => undefined },
        { matchMedia: matchMedia(true) }
      )
    ).toEqual({ supportsViewTransitions: true, prefersReducedMotion: true });
  });

  it('reports no support when the API or matchMedia is missing', () => {
    expect(readMotionEnvironment({}, {})).toEqual({
      supportsViewTransitions: false,
      prefersReducedMotion: false,
    });
    expect(readMotionEnvironment(undefined, undefined)).toEqual({
      supportsViewTransitions: false,
      prefersReducedMotion: false,
    });
  });
});

describe('getRevealMode', () => {
  it('animates with a view transition when supported', () => {
    expect(
      getRevealMode({ supportsViewTransitions: true, prefersReducedMotion: false })
    ).toBe('view-transition');
  });

  it('falls back to the timed reveal without View Transitions', () => {
    expect(
      getRevealMode({ supportsViewTransitions: false, prefersReducedMotion: false })
    ).toBe('timed');
  });

  it('reveals instantly for reduced motion, supported or not', () => {
    for (const supportsViewTransitions of [true, false]) {
      expect(
        getRevealMode({ supportsViewTransitions, prefersReducedMotion: true })
      ).toBe('instant');
    }
  });
});

describe('runInViewTransition', () => {
  it('runs the update directly without View Transitions', () => {
    const update = vi.fn();
    runInViewTransition(undefined, update);
    runInViewTransition({}, update);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('hands the update to startViewTransition on the document', () => {
    const update = vi.fn();
    const doc = {
      startViewTransition: vi.fn(function (
        this: unknown,
        callback: () => void
      ) {
        // The real API requires `this` to be the document.
        expect(this).toBe(doc);
        callback();
        return { ready: Promise.resolve() };
      }),
    };

    runInViewTransition(doc, update);

    expect(doc.startViewTransition).toHaveBeenCalledWith(update);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('swallows the rejection of a skipped transition', async () => {
    const update = vi.fn();
    const ready = Promise.reject(new DOMException('Skipped', 'AbortError'));
    const catchSpy = vi.spyOn(ready, 'catch');

    runInViewTransition(
      {
        startViewTransition(callback) {
          callback();
          return { ready };
        },
      },
      update
    );

    expect(catchSpy).toHaveBeenCalledTimes(1);
    await expect(ready).rejects.toThrow('Skipped');
    expect(update).toHaveBeenCalledTimes(1);
  });
});
