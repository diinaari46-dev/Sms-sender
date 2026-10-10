/**
 * Normalizes Somali phone numbers into standard +25261xxxxxxx format.
 * Accepts:
 *  - 61xxxxxxx (9 digits starting with 6 or 7, e.g. 612345678)
 *  - 061xxxxxxx (10 digits starting with 06 or 07, e.g. 0612345678)
 *  - 25261xxxxxxx (12 digits starting with 252)
 *  - +25261xxxxxxx (13 chars starting with +252)
 *  - +252061xxxxxxx or 252061xxxxxxx (strips trunk 0 after country code)
 */
export interface PhoneNormalizationResult {
  isValid: boolean;
  normalized: string; // e.g., "+252612345678"
  digitsOnly: string; // e.g., "252612345678"
  fakeEmail: string;  // e.g., "252612345678@smsapp.local"
  errorKey?: 'invalid_phone';
}

export function normalizeSomaliPhone(rawInput: string): PhoneNormalizationResult {
  const cleaned = rawInput.trim().replace(/[\s\-().]/g, '');

  if (!cleaned) {
    return {
      isValid: false,
      normalized: '',
      digitsOnly: '',
      fakeEmail: '',
      errorKey: 'invalid_phone',
    };
  }

  let localNine = '';

  if (cleaned.startsWith('+252')) {
    const rest = cleaned.slice(4);
    localNine = rest.startsWith('0') && rest.length === 10 ? rest.slice(1) : rest;
  } else if (cleaned.startsWith('252') && cleaned.length >= 11) {
    const rest = cleaned.slice(3);
    localNine = rest.startsWith('0') && rest.length === 10 ? rest.slice(1) : rest;
  } else if (cleaned.startsWith('0') && cleaned.length === 10) {
    localNine = cleaned.slice(1);
  } else if (cleaned.length === 9) {
    localNine = cleaned;
  } else {
    return {
      isValid: false,
      normalized: '',
      digitsOnly: '',
      fakeEmail: '',
      errorKey: 'invalid_phone',
    };
  }

  // Exactly 9 digits
  const isValid = /^\d{9}$/.test(localNine);

  if (!isValid) {
    return {
      isValid: false,
      normalized: '',
      digitsOnly: '',
      fakeEmail: '',
      errorKey: 'invalid_phone',
    };
  }

  const digitsOnly = `252${localNine}`;
  const normalized = `+${digitsOnly}`;
  const fakeEmail = `${digitsOnly}@smsapp.local`;

  return {
    isValid: true,
    normalized,
    digitsOnly,
    fakeEmail,
  };
}

/**
 * Extracts a formatted phone number (+25261xxxxxxx) from a Supabase fake email or user metadata.
 */
export function extractPhoneFromEmail(email?: string | null, metadataPhone?: string | null): string {
  if (metadataPhone && metadataPhone.startsWith('+252')) {
    return metadataPhone;
  }
  if (!email) return '';
  const localPart = email.split('@')[0] || '';
  const digits = localPart.replace(/\D/g, '');
  if (digits.startsWith('252')) {
    return `+${digits}`;
  }
  return localPart;
}

/**
 * Formats a +25261xxxxxxx phone string for readable display while preserving copyability.
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';
  const norm = normalizeSomaliPhone(phone);
  return norm.isValid ? norm.normalized : phone;
}
