import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

export function normalizeToE164(
  input: string | null | undefined,
  defaultCountry: CountryCode = 'IN'
): string | null {
  if (!input) return null;
  const cleaned = String(input).trim();
  if (!cleaned) return null;
  const parsed = parsePhoneNumberFromString(cleaned, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

export function isValidE164(input: string | null | undefined): boolean {
  return normalizeToE164(input) !== null;
}
