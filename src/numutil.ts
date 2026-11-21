/**
 * Extracts the first numeric token from loosely formatted text like
 * "Rs. 46,070.00" or "LKR 375,000.00", ignoring currency prefixes
 * (a naive strip-non-digits approach breaks on prefixes like "Rs." whose
 * own period gets mistaken for a decimal point).
 */
export function extractNumber(text: string): number {
  const match = text.match(/\d[\d,]*\.?\d*/);
  if (!match) return NaN;
  return Number(match[0].replace(/,/g, ""));
}
