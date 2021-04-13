import { isFirst } from './utils2';

/**
 * Returns type-ahead options for the given DSCP codes.
 *
 * Type-ahead options are the codes themselves, symbolic names for these codes, and ip precedence groups that cover
 * these codes.
 *
 * Duplicates are removed, the result is ordered lexicographically.
 */
export function dscpTypeAheadOptions(codes: number[]): string[] {
  const mappedCodes = codes.map((c) => (c >= 0 && c < dscpCodes.length ? dscpCodes[c].inputOptions : []));
  return ([] as string[])
    .concat(...mappedCodes)
    .filter(isFirst)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Returns selection options for the given DSCP codes.
 *
 * Select options are the codes themselves and the ip precedence groups that cover these codes.
 *
 * Select options for codes that have a symbolic name are labelled by their symbolic name followed by their numeric
 * code in parentheses. Codes that have no symbolic name are labelled by their numeric code only.
 *
 * Duplicates are removed, the result is ordered lexicographically according to the text of the selection options.
 */
export function dscpSelectOptions(codes: number[]): Array<{ text: string; value: string }> {
  const mappedCodes = codes.map((c) => (c >= 0 && c < dscpCodes.length ? [dscpCodes[c]] : []));
  const uniqueCodes = ([] as DscpCode[]).concat(...mappedCodes).filter(isFirst);
  const precedences = uniqueCodes
    .map((c) => c.ipPrecedence)
    .filter((p) => p !== undefined)
    .filter(isFirst);
  return [
    ...uniqueCodes.map((c) => ({ text: c.label, value: `${c.code}` })).sort((a, b) => a.text.localeCompare(b.text)),
    ...precedences.map((p) => ({ text: `P${p}`, value: `P${p}` })),
  ];
}

/**
 * Return the dscp label for the given code.
 */
export function dscpLabel(code: string): string {
  return dscpCodes[+code].label;
}

export class DscpCode {
  constructor(readonly code: number, public symbolicName?: string, public ipPrecedence?: number) {}

  /**
   * Gets the label for this dscp code.
   *
   * If there is a symbolic name for this code then the label is the symbolic name followed by the code number
   * in parentheses otherwise the code number is returned as a string.
   */
  get label(): string {
    return this.symbolicName ? `${this.symbolicName} (${this.code})` : `${this.code}`;
  }

  /**
   * Returns an array of input options that can be used to select this dscp code.
   */
  get inputOptions(): string[] {
    return [
      `${this.code}`,
      ...(this.symbolicName ? [this.symbolicName] : []),
      ...(this.ipPrecedence !== undefined ? [`P${this.ipPrecedence}`] : []),
    ];
  }
}

const dscpCodes: DscpCode[] = new Array(64);

for (let i = 0; i < 64; i++) {
  dscpCodes[i] = new DscpCode(i);
}

for (let p = 0; p < 8; p++) {
  for (let i = 0; i < 4; i++) {
    dscpCodes[p * 8 + i * 2].ipPrecedence = p;
  }
}

for (let c = 0; c < 8; c++) {
  dscpCodes[c * 8].symbolicName = `CS${c}`;
  if (c >= 1 && c <= 4) {
    for (let d = 1; d <= 3; d++) {
      dscpCodes[c * 8 + d * 2].symbolicName = `AF${c}${d}`;
    }
  }
}

dscpCodes[1].symbolicName = 'LE';
dscpCodes[46].symbolicName = 'EF';
