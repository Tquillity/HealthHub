import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { restoreFocus, tabTrapTarget, useDialogOpener } from './dialog-focus';

/** A node in a tiny fake document: `order` is its position in document order. */
class FakeNode {
  constructor(
    readonly name: string,
    readonly order: number,
    readonly parent: FakeNode | null = null
  ) {}

  contains(other: FakeNode | null): boolean {
    for (let node = other; node; node = node.parent) {
      if (node === this) return true;
    }
    return false;
  }

  /** Same bits as Node.compareDocumentPosition. */
  compareDocumentPosition(other: FakeNode): number {
    if (other === this) return 0;
    if (this.contains(other)) return 0x10 | 0x04; // contained by, following
    if (other.contains(this)) return 0x08 | 0x02; // contains, preceding
    return other.order > this.order ? 0x04 : 0x02;
  }
}

// <button trigger/> <div panel tabindex=-1><h2 title/><input/><button cancel/>
// <button confirm/></div>: the trigger (order 0) sits before the dialog.
const panel = new FakeNode('panel', 1);
const title = new FakeNode('title', 2, panel);
const input = new FakeNode('input', 3, panel);
const cancel = new FakeNode('cancel', 4, panel);
const confirm = new FakeNode('confirm', 5, panel);
const items = [input, cancel, confirm];

describe('tabTrapTarget', () => {
  it('keeps Shift+Tab inside after a click on non-interactive dialog content', () => {
    // A click on the dialog text focuses the panel (tabIndex -1); the browser's own
    // Shift+Tab would go to the trigger behind the overlay.
    expect(tabTrapTarget(items, panel, true)).toBe(confirm);
    expect(tabTrapTarget(items, title, true)).toBe(confirm);
  });

  it('lets Tab from the panel go to its first item', () => {
    expect(tabTrapTarget(items, panel, false)).toBeNull();
  });

  it('wraps at both ends', () => {
    expect(tabTrapTarget(items, confirm, false)).toBe(input);
    expect(tabTrapTarget(items, input, true)).toBe(confirm);
  });

  it('leaves moves between items to the browser', () => {
    expect(tabTrapTarget(items, input, false)).toBeNull();
    expect(tabTrapTarget(items, cancel, true)).toBeNull();
    expect(tabTrapTarget(items, cancel, false)).toBeNull();
  });

  it('brings focus from outside back in', () => {
    expect(tabTrapTarget(items, null, false)).toBe(input);
    expect(tabTrapTarget(items, null, true)).toBe(confirm);
  });

  it('has nothing to move to without items', () => {
    expect(tabTrapTarget([], panel, true)).toBeNull();
  });
});

describe('useDialogOpener', () => {
  class FakeHTMLElement {
    constructor(readonly name: string) {}
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function openerSeenWhileRendering(open: boolean, active: FakeHTMLElement | null) {
    const body = new FakeHTMLElement('body');
    vi.stubGlobal('HTMLElement', FakeHTMLElement);
    vi.stubGlobal('document', { activeElement: active ?? body, body });
    let seen: unknown = 'not rendered';
    function Probe() {
      seen = useDialogOpener(open);
      return null;
    }
    // Server rendering runs no effects and commits nothing: what the hook returns here
    // is known before an autoFocus field inside the dialog could take focus.
    renderToString(createElement(Probe));
    return seen;
  }

  it('records the opener while rendering, before any effect or autoFocus', () => {
    const button = new FakeHTMLElement('Delete button');
    expect(openerSeenWhileRendering(true, button)).toBe(button);
  });

  it('records nothing while closed, or when focus was on the page body', () => {
    expect(openerSeenWhileRendering(false, new FakeHTMLElement('x'))).toBeNull();
    expect(openerSeenWhileRendering(true, null)).toBeNull();
  });
});

describe('restoreFocus', () => {
  function element(isConnected = true) {
    return { isConnected, focus: vi.fn() };
  }

  it('focuses the opener when focus was lost with the closed dialog', () => {
    const body = element();
    const opener = element();
    restoreFocus(opener, { activeElement: body, body });
    expect(opener.focus).toHaveBeenCalledOnce();

    const removedInput = element(false);
    const other = element();
    restoreFocus(other, { activeElement: removedInput, body });
    expect(other.focus).toHaveBeenCalledOnce();

    const third = element();
    restoreFocus(third, { activeElement: null, body });
    expect(third.focus).toHaveBeenCalledOnce();
  });

  it('leaves focus that was moved elsewhere on purpose, or a removed opener', () => {
    const body = element();
    const opener = element();
    restoreFocus(opener, { activeElement: element(), body });
    expect(opener.focus).not.toHaveBeenCalled();

    const gone = element(false);
    restoreFocus(gone, { activeElement: body, body });
    expect(gone.focus).not.toHaveBeenCalled();
    restoreFocus(null, { activeElement: body, body });
  });
});
