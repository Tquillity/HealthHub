/**
 * Helpers for same-document view transitions (document.startViewTransition()).
 * Spec: https://www.w3.org/TR/css-view-transitions-1/
 * Browser support: https://developer.mozilla.org/docs/Web/API/Document/startViewTransition
 */

/**
 * How a UI change is revealed:
 * - `view-transition`: animated by the browser with document.startViewTransition().
 * - `timed`: the browser has no View Transitions, so keep the old fixed delay before the change.
 * - `instant`: the user asked for reduced motion, so apply the change at once.
 */
export type RevealMode = 'view-transition' | 'timed' | 'instant';

export type MotionEnvironment = {
  supportsViewTransitions: boolean;
  prefersReducedMotion: boolean;
};

type MotionDocument = { startViewTransition?: unknown };
type MotionWindow = { matchMedia?: (query: string) => { matches: boolean } };

/** Feature-detects View Transitions and reads `prefers-reduced-motion` (false on the server). */
export function readMotionEnvironment(
  doc: MotionDocument | undefined,
  win: MotionWindow | undefined
): MotionEnvironment {
  return {
    supportsViewTransitions: typeof doc?.startViewTransition === 'function',
    prefersReducedMotion:
      win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  };
}

/** Reduced motion wins over everything; otherwise animate when the browser can. */
export function getRevealMode(env: MotionEnvironment): RevealMode {
  if (env.prefersReducedMotion) return 'instant';
  return env.supportsViewTransitions ? 'view-transition' : 'timed';
}

type ViewTransitionLike = { ready: Promise<unknown> };
type ViewTransitionDocument = {
  startViewTransition?(update: () => void): ViewTransitionLike;
};

/**
 * Applies `update` inside document.startViewTransition() when `doc` supports it, otherwise
 * directly. `update` must change the DOM synchronously, because the browser captures the new
 * state as soon as it returns: with React, wrap the state updates in flushSync.
 */
export function runInViewTransition(
  doc: ViewTransitionDocument | undefined,
  update: () => void
): void {
  if (typeof doc?.startViewTransition !== 'function') {
    update();
    return;
  }
  const transition = doc.startViewTransition(update);
  // `ready` rejects when the browser skips the animation (for example in a hidden tab). The
  // update has still run, so there is nothing to recover; just keep it out of the console.
  transition.ready.catch(() => {});
}
