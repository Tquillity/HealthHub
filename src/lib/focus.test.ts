import { describe, expect, it } from 'vitest';
import { isFocusLeaving } from './focus';

describe('isFocusLeaving', () => {
  const inside = { id: 'inside' } as unknown as EventTarget;
  const outside = { id: 'outside' } as unknown as EventTarget;
  const container = { contains: (node: Node | null) => node === (inside as unknown as Node) };

  it('is true when focus moves to an element outside the container', () => {
    expect(isFocusLeaving(container, outside)).toBe(true);
  });

  it('is false when focus stays inside the container', () => {
    expect(isFocusLeaving(container, inside)).toBe(false);
  });

  it('is false when nothing focusable took focus, or there is no container', () => {
    expect(isFocusLeaving(container, null)).toBe(false);
    expect(isFocusLeaving(null, outside)).toBe(false);
  });
});
