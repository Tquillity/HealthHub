import { describe, expect, it } from 'vitest';
import { getInitials } from './initials';

describe('getInitials', () => {
  it('uses the first and last word', () => {
    expect(getInitials('Ada Lovelace')).toBe('AL');
    expect(getInitials('ada king lovelace')).toBe('AL');
    expect(getInitials('Åsa')).toBe('Å');
    expect(getInitials('  ')).toBe('?');
    expect(getInitials(null)).toBe('?');
  });
});
