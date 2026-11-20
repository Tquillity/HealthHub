/**
 * Text for PDFs drawn with the built-in PDF fonts (Helvetica). Those fonts only have
 * the Windows-1252 ("WinAnsi") character set: Latin-1 (so å, ä, ö, é, °, × work) plus
 * a few typographic characters. Anything else, such as emoji, would print as garbage,
 * so it is mapped to a close ASCII equivalent, dropped (emoji and invisible marks) or
 * shown as "?" (other scripts).
 * Character set: ISO 32000-1:2008, Annex D.2 "Latin character set and encodings".
 */

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
  ' ': ' ', // thin space
  ' ': ' ', // hair space
  ' ': ' ', // narrow no-break space
  '′': "'", // prime
  '″': '"', // double prime
  '≤': '<=',
  '≥': '>=',
  '→': '->',
  '←': '<-',
  '✓': 'v',
};

const DROP = /[\p{Extended_Pictographic}\p{M}\p{Cf}\p{Cc}\u{1F3FB}-\u{1F3FF}]/u;

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
    const code = char.codePointAt(0) ?? 0;
    if (
      (code >= 0x20 && code <= 0x7e) ||
      (code >= 0xa0 && code <= 0xff) ||
      WIN_ANSI_EXTRAS.has(char)
    ) {
      out += char;
    } else if (REPLACEMENTS[char] !== undefined) {
      out += REPLACEMENTS[char];
    } else if (!DROP.test(char)) {
      out += '?';
    }
  }
  return out;
}
