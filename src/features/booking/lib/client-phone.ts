export const CLIENT_PHONE_FORMAT_MESSAGE =
  "Telefon zadejte ve formátu 777 123 456 nebo +420 777 123 456.";

const allowedClientPhoneInputPattern = /^[+\d\s-]+$/;
const normalizedClientPhonePattern = /^\+\d{8,15}$/;

export function normalizeClientPhone(phone?: string) {
  const trimmed = phone?.trim() ?? "";

  if (!trimmed) {
    return undefined;
  }

  if (!allowedClientPhoneInputPattern.test(trimmed)) {
    return undefined;
  }

  const compact = trimmed.replace(/[\s-]+/g, "");

  if (compact.startsWith("+")) {
    const rest = compact.slice(1);

    if (!/^\d+$/.test(rest)) {
      return undefined;
    }

    return `+${rest}`;
  }

  if (compact.startsWith("00")) {
    const rest = compact.slice(2);

    if (!/^\d+$/.test(rest)) {
      return undefined;
    }

    return `+${rest}`;
  }

  if (/^\d{9}$/.test(compact)) {
    return `+420${compact}`;
  }

  return undefined;
}

export function isValidNormalizedClientPhone(phone?: string) {
  if (!phone) {
    return true;
  }

  return normalizedClientPhonePattern.test(phone);
}

export function isValidClientPhoneInput(phone?: string) {
  const trimmed = phone?.trim() ?? "";

  if (!trimmed) {
    return true;
  }

  const normalized = normalizeClientPhone(trimmed);

  return Boolean(normalized && isValidNormalizedClientPhone(normalized));
}

export function formatClientPhoneForDisplay(phone?: string | null) {
  const normalized = normalizeClientPhone(phone ?? undefined);

  if (!normalized) {
    return phone?.trim() ?? "";
  }

  if (normalized.startsWith("+420") && normalized.length === 13) {
    return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7, 10)} ${normalized.slice(10)}`;
  }

  const match = normalized.match(/^(\+\d{3})(\d{3})(\d{3})(\d+)$/);

  if (match) {
    return `${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
  }

  return normalized;
}

export function buildClientPhoneHref(phone?: string | null) {
  const normalized = normalizeClientPhone(phone ?? undefined);

  return normalized ? `tel:${normalized}` : null;
}
