import { describe, it, expect } from 'vitest';
import {
  getAllOptions,
  hasAlternatives,
  normalizePatternKey,
  parseIngredientAlternatives,
} from '@/lib/ingredient-alternatives';

describe('parseIngredientAlternatives', () => {
  it('parses Swedish eller pattern', () => {
    const parsed = parseIngredientAlternatives('smör eller kokosolja');
    expect(parsed.name).toBe('smör');
    expect(parsed.alternatives).toEqual(['kokosolja']);
  });

  it('parses English or pattern', () => {
    const parsed = parseIngredientAlternatives('butter or coconut oil');
    expect(parsed.name).toBe('butter');
    expect(parsed.alternatives).toEqual(['coconut oil']);
  });

  it('parses slash notation', () => {
    const parsed = parseIngredientAlternatives('olja/smör');
    expect(parsed.alternatives).toHaveLength(1);
  });

  it('parses parenthetical eller', () => {
    const parsed = parseIngredientAlternatives('kokosolja (eller smör)');
    expect(parsed.name).toBe('kokosolja');
    expect(parsed.alternatives[0]).toBe('smör');
  });

  it('returns empty alternatives for plain names', () => {
    const parsed = parseIngredientAlternatives('gul lök');
    expect(parsed.alternatives).toEqual([]);
    expect(parsed.name).toBe('gul lök');
  });

  it('handles empty string', () => {
    const parsed = parseIngredientAlternatives('');
    expect(parsed.name).toBe('');
    expect(parsed.alternatives).toEqual([]);
  });
});

describe('normalizePatternKey', () => {
  it('sorts options for stable keys', () => {
    const a = normalizePatternKey('smör', ['kokosolja']);
    const b = normalizePatternKey('kokosolja', ['smör']);
    expect(a).toBe(b);
  });
});

describe('hasAlternatives', () => {
  it('detects alternatives in ingredient text', () => {
    expect(hasAlternatives('smör eller kokosolja')).toBe(true);
    expect(hasAlternatives('salt')).toBe(false);
  });
});

describe('getAllOptions', () => {
  it('returns main name plus alternatives', () => {
    expect(getAllOptions('smör', ['kokosolja'])).toEqual(['smör', 'kokosolja']);
  });
});
