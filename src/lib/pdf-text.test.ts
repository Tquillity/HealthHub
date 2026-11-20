import { describe, expect, it } from 'vitest';
import { toPdfText } from '@/lib/pdf-text';

describe('toPdfText', () => {
  it('keeps ASCII, Latin-1 and WinAnsi punctuation', () => {
    const text = 'Smör, ägg & öl – 36.5 °C × 2 “quoted” … €5';
    expect(toPdfText(text)).toBe(text);
  });

  it('keeps line breaks and turns tabs into spaces', () => {
    expect(toPdfText('a\tb\r\nc')).toBe('a b\nc');
  });

  it('maps common symbols to ASCII', () => {
    expect(toPdfText('≥ 7 h → better − 2')).toBe('>= 7 h -> better - 2');
  });

  it('drops emoji and invisible marks, and replaces other scripts', () => {
    expect(toPdfText('Tired 😴 today 👍🏽')).toBe('Tired  today ');
    expect(toPdfText('Heart ❤️')).toBe('Heart ');
    expect(toPdfText('頭痛')).toBe('??');
  });

  it('composes decomposed letters first', () => {
    expect(toPdfText('ä')).toBe('ä');
  });
});
