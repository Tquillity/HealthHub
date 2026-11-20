import { describe, expect, it } from 'vitest';
import { toPdfText, UNPRINTABLE_TEXT } from '@/lib/pdf-text';

describe('toPdfText', () => {
  it('keeps ASCII, Latin-1 and WinAnsi punctuation', () => {
    const text = 'Smör, ägg & öl – 36.5 °C × 2 “quoted” … €5 © ™';
    expect(toPdfText(text)).toBe(text);
  });

  it('keeps line breaks and turns tabs into spaces', () => {
    expect(toPdfText('a\tb\r\nc')).toBe('a b\nc');
  });

  it('maps common symbols to ASCII', () => {
    expect(toPdfText('≥ 7 h → better − 2')).toBe('>= 7 h -> better - 2');
    // Thin, hair and narrow no-break spaces.
    expect(toPdfText('5 h 1 °C')).toBe('5 h 1 °C');
  });

  it('drops emoji and invisible marks', () => {
    expect(toPdfText('Tired 😴 today 👍🏽')).toBe('Tired  today ');
    expect(toPdfText('Heart ❤️')).toBe('Heart ');
  });

  it('drops flag emoji instead of printing question marks', () => {
    expect(toPdfText('Holiday 🇸🇪')).toBe('Holiday ');
    expect(toPdfText('🇸🇪🇳🇴')).toBe('');
    // Subdivision flag (tag characters) and the rainbow flag (ZWJ sequence).
    expect(toPdfText('Trip 🏴󠁧󠁢󠁳󠁣󠁴󠁿 🏳️‍🌈')).toBe('Trip  ');
    // Keycap: the digit stays, its emoji parts go.
    expect(toPdfText('1️⃣ dose')).toBe('1 dose');
  });

  it('never prints "?" for a character it cannot map', () => {
    for (const text of [
      '🇸🇪',
      '🇺🇳',
      '★ ☆ ♀ ♂ ✈ ⚕',
      '∑ ∞ ⊕',
      '\u{E000}\u{F8FF}',
      '\u{10FFFD}',
      'Головная боль',
      '頭痛',
      'ἀλγεῖ',
    ]) {
      expect(toPdfText(text)).not.toContain('?');
    }
    expect(toPdfText('Why?')).toBe('Why?');
  });

  it('keeps Latin letters the fonts lack as their base letter', () => {
    expect(toPdfText('Ból głowy, ő, ş, ę, Ł')).toBe('Ból glowy, o, s, e, L');
    expect(toPdfText('ﬁne 3 ℃')).toBe('fine 3 °C');
  });

  it('marks text in other scripts as left out, once per run', () => {
    expect(toPdfText('Pain 頭痛 today')).toBe(`Pain ${UNPRINTABLE_TEXT} today`);
    expect(toPdfText('Головная боль, тошнота')).toBe(
      `${UNPRINTABLE_TEXT}, ${UNPRINTABLE_TEXT}`
    );
    expect(UNPRINTABLE_TEXT).not.toContain('?');
  });

  it('composes decomposed letters first', () => {
    // Escaped so an editor cannot compose the input: "a" + combining diaeresis.
    expect(toPdfText('a\u0308')).toBe('\u00e4');
    expect(toPdfText('a\u030Angest, e\u0301t\u00e9')).toBe(
      '\u00e5ngest, \u00e9t\u00e9'
    );
    // No precomposed WinAnsi letter: falls back to the base letter.
    expect(toPdfText('o\u030B')).toBe('o');
  });
});
