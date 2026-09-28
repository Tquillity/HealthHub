import { describe, expect, it } from 'vitest';
import { escapeCsvCell, toCsv } from '@/lib/csv';

describe('escapeCsvCell', () => {
  it('quotes plain values', () => {
    expect(escapeCsvCell('Milk')).toBe('"Milk"');
    expect(escapeCsvCell(1.5)).toBe('"1.5"');
  });

  it('doubles embedded quotes', () => {
    expect(escapeCsvCell('12" pizza')).toBe('"12"" pizza"');
  });

  it('keeps commas and newlines inside the quoted cell', () => {
    expect(escapeCsvCell('salt, pepper\nmix')).toBe('"salt, pepper\nmix"');
  });

  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\t=x', '\r=x'])(
    'neutralises formula-looking cell %j',
    (value) => {
      expect(escapeCsvCell(value)).toBe(`"'${value}"`);
    }
  );

  it('neutralises and escapes together', () => {
    expect(escapeCsvCell('=HYPERLINK("http://x")')).toBe(
      '"\'=HYPERLINK(""http://x"")"'
    );
  });
});

describe('toCsv', () => {
  it('joins escaped rows', () => {
    expect(
      toCsv([
        ['Item', 'Quantity'],
        ['Eggs', 6],
      ])
    ).toBe('"Item","Quantity"\n"Eggs","6"');
  });
});
