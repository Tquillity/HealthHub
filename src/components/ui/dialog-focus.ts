import { useState } from 'react';

/**
 * Focus rules of the modal Dialog (components/ui/dialog), kept free of the DOM so they
 * can be unit tested: who opened the dialog, where Tab goes, and where focus returns.
 * WAI-ARIA Authoring Practices, modal dialog pattern:
 * https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
 */

/** The part of a DOM node the Tab rule needs. */
export interface FocusNode {
  compareDocumentPosition(other: FocusNode): number;
}

/** Node.DOCUMENT_POSITION_FOLLOWING (no `Node` global outside the browser). */
const DOCUMENT_POSITION_FOLLOWING = 4;

/** True when `b` comes after `a` in document order (a descendant comes after its ancestor). */
function isAfter(a: FocusNode, b: FocusNode): boolean {
  return (a.compareDocumentPosition(b) & DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/**
 * Where Tab (Shift+Tab when `backwards`) must move focus to keep it inside the dialog,
 * or null when the browser's own move stays inside. `items` are the dialog's focusable
 * elements in document order, `active` the focused element when it is inside the
 * dialog, otherwise null. Focus wraps past the last and the first item, also when it
 * sits on something that is not an item, such as the dialog panel itself after a click
 * on its text: from there the browser would leave the dialog.
 */
export function tabTrapTarget<T extends FocusNode>(
  items: readonly T[],
  active: FocusNode | null,
  backwards: boolean
): T | null {
  if (items.length === 0) return null;
  const first = items[0];
  const last = items[items.length - 1];
  if (active === null) return backwards ? last : first;
  if (backwards) {
    const hasPrevious = items.some((item) => item !== active && isAfter(item, active));
    return hasPrevious ? null : last;
  }
  const hasNext = items.some((item) => item !== active && isAfter(active, item));
  return hasNext ? null : first;
}

function focusedElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}

/**
 * The element that had focus when the dialog opened, or null while it is closed. It is
 * read while React renders the opening dialog, before anything is committed: an
 * autoFocus field inside the dialog takes focus during the commit, before any effect
 * runs, so an effect would see that field instead of the opener.
 */
export function useDialogOpener(open: boolean): HTMLElement | null {
  const [state, setState] = useState<{
    open: boolean;
    opener: HTMLElement | null;
  }>({ open: false, opener: null });
  if (state.open !== open) {
    // Adjusting state while rendering, as React documents for reacting to a prop change.
    const next = { open, opener: open ? focusedElement() : null };
    setState(next);
    return next.opener;
  }
  return state.opener;
}

/**
 * Returns focus to the opener after the dialog closed, whatever had focus inside it.
 * Skipped when the opener is gone from the page, or when focus has already been moved
 * somewhere else on purpose (it is not lost on the page body or a removed element).
 */
export function restoreFocus(
  opener: { focus(): void; readonly isConnected: boolean } | null,
  doc: { activeElement: { readonly isConnected: boolean } | null; body: unknown }
): void {
  if (!opener?.isConnected) return;
  const active = doc.activeElement;
  if (active === null || active === doc.body || !active.isConnected) opener.focus();
}
