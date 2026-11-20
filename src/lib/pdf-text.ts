/**
 * Text for PDFs drawn with the built-in PDF fonts (Helvetica). Those fonts only have
 * the Windows-1252 ("WinAnsi") character set: Latin-1 (so å, ä, ö, é, °, × work) plus
 * a few typographic characters. Anything else would print as garbage, so it is:
 * - mapped to a close equivalent: common symbols ("≥" → ">="), and Latin letters with
 *   an accent the fonts lack to their base letter ("ő" → "o", "ł" → "l");
 * - dropped when it carries no text: emoji and their parts (flags included), invisible
 *   marks and controls, and symbols the fonts lack;
 * - marked once per run with UNPRINTABLE_TEXT when it is text in another script, so a
 *   reader can see that words were left out rather than read a silently shortened note.
 * Nothing is ever printed as "?".
 * Character set: ISO 32000-1:2008, Annex D.2 "Latin character set and encodings".
 */

/** Stands for a run of words in a script the PDF fonts cannot draw. */
export const UNPRINTABLE_TEXT = '[…]';

/**
 * Emoji and their parts: pictographs, flags (regional indicator pairs and tag
 * sequences), skin tones, joiners, variation selectors and keycaps.
 */
export const EMOJI_PART =
  /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]|‍|⃣|︎|️/u;

/** The WinAnsi characters outside Latin-1 (code points 0x80-0x9F in Windows-1252). */
const WIN_ANSI_EXTRAS = new Set(
  Array.from('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')
);

const REPLACEMENTS: Record<string, string> = {
  '‐': '-', // hyphen
  '‑': '-', // non-breaking hyphen
  '‒': '-', // figure dash
  '―': '—', // horizontal bar
  '−': '-', // minus sign
  '′': "'", // prime
  '″': '"', // double prime
  '≤': '<=',
  '≥': '>=',
  '→': '->',
  '←': '<-',
  '✓': 'v',
  // Latin letters without a decomposition to a base letter.
  ł: 'l',
  Ł: 'L',
  đ: 'd',
  Đ: 'D',
  ı: 'i',
};

/** Combining marks left after composing, controls, format, private-use and unassigned. */
const INVISIBLE = /[\p{M}\p{C}]/u;
/** Thin, hair, narrow no-break and other spaces outside Latin-1. */
const SPACE = /\p{Zs}/u;
const LINE_BREAK = /[\p{Zl}\p{Zp}]/u;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const TRAILING_SPACES = / +$/;

function isWinAnsi(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (
    (code >= 0x20 && code <= 0x7e) ||
    (code >= 0xa0 && code <= 0xff) ||
    WIN_ANSI_EXTRAS.has(char)
  );
}

/**
 * The compatibility decomposition without accents ("ő" → "o", "ﬁ" → "fi", "℃" → "°C")
 * when all of it is printable, otherwise null.
 */
function compatibleFallback(char: string): string | null {
  const base = char.normalize('NFKD').replace(/\p{M}/gu, '');
  return base && Array.from(base).every(isWinAnsi) ? base : null;
}

export function toPdfText(text: string): string {
  let out = '';
  for (const char of text.normalize('NFC')) {
    if (char === '\n') {
      out += char;
      continue;
    }
    if (char === '\t' || char === '\r') {
      out += char === '\t' ? ' ' : '';
      continue;
    }
    if (isWinAnsi(char)) {
      out += char;
      continue;
    }
    const replacement = REPLACEMENTS[char];
    if (replacement !== undefined) {
      out += replacement;
      continue;
    }
    if (EMOJI_PART.test(char) || INVISIBLE.test(char)) continue;
    if (SPACE.test(char)) {
      out += ' ';
      continue;
    }
    if (LINE_BREAK.test(char)) {
      out += '\n';
      continue;
    }
    const fallback = compatibleFallback(char);
    if (fallback !== null) {
      out += fallback;
      continue;
    }
    if (LETTER_OR_DIGIT.test(char)) {
      // One marker for a run of such words ("Головная боль" → "[…]").
      const trimmed = out.replace(TRAILING_SPACES, '');
      out = trimmed.endsWith(UNPRINTABLE_TEXT) ? trimmed : out + UNPRINTABLE_TEXT;
    }
    // Anything else is a symbol or punctuation mark the fonts lack: dropped.
  }
  return out;
}
