const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

// Standard 18-character Mexican CURP format (4 letters, 6 digits for the
// birth date, 1 letter for sex, 2 letters for state, 3 consonants, 1
// alphanumeric homoclave digit, 1 check digit). This checks the shape, not
// that the CURP is real/assigned.
const CURP_RE = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;

export function isValidCurp(value: string): boolean {
  return CURP_RE.test(value.toUpperCase());
}
