import { type CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js';

const DEFAULT_COUNTRY: CountryCode = 'FR';

function normalizeCallingCode(phoneCode: string | null | undefined): string | null {
  if (!phoneCode) return null;
  const digits = phoneCode.replace(/\D/g, '');
  return digits ? `+${digits}` : null;
}

function parsePhone(
  phone: string | null | undefined,
  phoneCode?: string | null,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
) {
  if (!phone) return null;

  const compactPhone = phone.trim().replace(/[^\d+]/g, '');
  const digitsOnly = phone.replace(/\D/g, '');
  const callingCode = normalizeCallingCode(phoneCode);
  const candidates = new Set<string>();

  if (compactPhone.startsWith('+')) candidates.add(compactPhone);
  if (callingCode && digitsOnly) {
    candidates.add(`${callingCode}${digitsOnly.replace(/^0+/, '') || digitsOnly}`);
    candidates.add(`${callingCode}${digitsOnly}`);
  }
  if (compactPhone) candidates.add(compactPhone);

  for (const candidate of candidates) {
    const parsed = parsePhoneNumberFromString(candidate);
    if (parsed?.isPossible()) return parsed;
  }

  if (compactPhone) {
    const national = parsePhoneNumberFromString(compactPhone, defaultCountry);
    if (national?.isPossible()) return national;
    if (national) return national;
  }

  for (const candidate of candidates) {
    const parsed = parsePhoneNumberFromString(candidate);
    if (parsed) return parsed;
  }

  return null;
}

export function formatPhoneDisplay(
  phone: string | null | undefined,
  phoneCode?: string | null,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
): string {
  if (!phone) return '—';
  const parsed = parsePhone(phone, phoneCode, defaultCountry);
  return parsed ? parsed.formatInternational() : phone.trim();
}

export function formatPhoneHref(
  phone: string | null | undefined,
  phoneCode?: string | null,
  defaultCountry: CountryCode = DEFAULT_COUNTRY,
): string | null {
  if (!phone) return null;
  const parsed = parsePhone(phone, phoneCode, defaultCountry);
  if (parsed) return parsed.number;

  const callingCode = normalizeCallingCode(phoneCode) ?? '';
  const digitsOnly = phone.replace(/\D/g, '');
  const fallback = `${callingCode}${digitsOnly}`.trim();
  return fallback || null;
}
