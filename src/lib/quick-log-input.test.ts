import { describe, expect, it } from 'vitest';
import {
  convertTemperatureInput,
  localDateKey,
  numberToInput,
  parseDecimalInput,
  parseWholeNumberInput,
} from './quick-log-input';

describe('parseDecimalInput', () => {
  it('reads dot and comma decimals', () => {
    expect(parseDecimalInput('36.45')).toBe(36.45);
    expect(parseDecimalInput(' 36,45 ')).toBe(36.45);
    expect(parseDecimalInput('98')).toBe(98);
  });

  it('treats empty text as clearing the value', () => {
    expect(parseDecimalInput('')).toBeNull();
    expect(parseDecimalInput('   ')).toBeNull();
  });

  it('rejects text that is not a plain number', () => {
    expect(parseDecimalInput('abc')).toBeUndefined();
    expect(parseDecimalInput('36.4.5')).toBeUndefined();
    expect(parseDecimalInput('-36')).toBeUndefined();
    expect(parseDecimalInput('1e2')).toBeUndefined();
  });
});

describe('parseWholeNumberInput', () => {
  it('accepts whole numbers and rejects decimals', () => {
    expect(parseWholeNumberInput('58')).toBe(58);
    expect(parseWholeNumberInput('')).toBeNull();
    expect(parseWholeNumberInput('58.5')).toBeUndefined();
    expect(parseWholeNumberInput('x')).toBeUndefined();
  });
});

describe('numberToInput', () => {
  it('shows nothing for unset values', () => {
    expect(numberToInput(null)).toBe('');
    expect(numberToInput(undefined)).toBe('');
    expect(numberToInput(36.5)).toBe('36.5');
  });
});

describe('convertTemperatureInput', () => {
  it('converts a typed value between units', () => {
    expect(convertTemperatureInput('36.5', 'C', 'F')).toBe('97.7');
    expect(convertTemperatureInput('97.7', 'F', 'C')).toBe('36.5');
    expect(convertTemperatureInput('36,5', 'C', 'F')).toBe('97.7');
  });

  it('keeps empty, invalid or same-unit text as typed', () => {
    expect(convertTemperatureInput('', 'C', 'F')).toBe('');
    expect(convertTemperatureInput('abc', 'C', 'F')).toBe('abc');
    expect(convertTemperatureInput('36,50', 'C', 'C')).toBe('36,50');
  });
});

describe('localDateKey', () => {
  it('uses the local calendar day', () => {
    expect(localDateKey(new Date(2026, 2, 5, 23, 30))).toBe('2026-03-05');
    expect(localDateKey(new Date(2026, 2, 6, 0, 15))).toBe('2026-03-06');
  });
});
