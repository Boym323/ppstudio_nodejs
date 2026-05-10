import { createHash } from "node:crypto";

export function sanitizeEmailHeaderValue(value: string, label = "E-mail header") {
  const normalized = value.trim();

  if (/[\r\n]/.test(normalized)) {
    throw new Error(`${label} nesmí obsahovat nový řádek.`);
  }

  return normalized;
}

export function isSafeEmailHeaderValue(value: string) {
  try {
    sanitizeEmailHeaderValue(value);
    return true;
  } catch {
    return false;
  }
}

export function maskEmailAddress(value: string) {
  const [localPart, domain] = value.trim().split("@");

  if (!localPart || !domain) {
    return "[invalid-email]";
  }

  const visible = localPart.slice(0, 2);

  return `${visible}${localPart.length > 2 ? "***" : "*"}@${domain}`;
}

export function anonymizeEmailSubject(value: string) {
  const safeSubject = sanitizeEmailHeaderValue(value, "E-mail subject");
  const hash = createHash("sha256").update(safeSubject).digest("hex").slice(0, 12);

  return {
    length: safeSubject.length,
    hash,
  };
}
