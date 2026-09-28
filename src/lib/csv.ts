/** Leading characters that spreadsheet apps may evaluate as a formula. */
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Escapes one CSV cell (RFC 4180): wraps it in quotes and doubles embedded
 * quotes. Cells that start with `=`, `+`, `-`, `@` (or tab / CR) are prefixed
 * with `'` so spreadsheets treat them as text, not formulas (CSV injection).
 */
export function escapeCsvCell(value: string | number): string {
  let text = String(value);
  if (FORMULA_TRIGGER.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** Serializes rows to CSV with every cell escaped. */
export function toCsv(
  rows: ReadonlyArray<ReadonlyArray<string | number>>
): string {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}
