import type { PublicBookingCatalog } from "@/features/booking/lib/booking-public";
import type { TimeSlotOption } from "@/features/booking/lib/booking-time-slots";

import type { ContactFieldKey } from "./types";

export const stepLabels = [
  "Výběr služby",
  "Výběr termínu",
  "Kontaktní údaje",
  "Kontrola a odeslání",
] as const;

export const EMPTY_TIME_SLOTS: TimeSlotOption[] = [];
export const WEEKDAY_LABELS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"] as const;
export const slotDateKeyFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Prague",
});
export const calendarGridColumnsStyle = {
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
} as const;

export function formatPrice(priceFromCzk: number | null) {
  if (!priceFromCzk) {
    return "Cena na vyžádání";
  }

  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(priceFromCzk);
}

export function formatSlotDate(startsAt: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Prague",
  }).format(new Date(startsAt));
}

export function formatSlotTime(value: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  }).format(new Date(value));
}

export function formatCalendarMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map((part) => Number(part));

  if (!year || !month) {
    return "";
  }

  return new Intl.DateTimeFormat("cs-CZ", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Prague",
  }).format(new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)));
}

export function formatDateKeyLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((part) => Number(part));

  if (!year || !month || !day) {
    return "";
  }

  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Prague",
  }).format(new Date(Date.UTC(year, month - 1, day, 12, 0, 0)));
}

export function getSlotDateKey(value: string) {
  const parsedValue = new Date(value);

  if (Number.isNaN(parsedValue.getTime())) {
    return "";
  }

  let year = "";
  let month = "";
  let day = "";

  for (const part of slotDateKeyFormatter.formatToParts(parsedValue)) {
    if (part.type === "year") {
      year = part.value;
    } else if (part.type === "month") {
      month = part.value;
    } else if (part.type === "day") {
      day = part.value;
    }
  }

  if (!year || !month || !day) {
    return "";
  }

  return `${year}-${month}-${day}`;
}

export function buildSlotAriaLabel(slot: TimeSlotOption) {
  return `Vybrat termín ${getSlotDateKey(slot.startsAt)} ${formatSlotTime(slot.startsAt)}`;
}

export function getSlotDayNumber(dateKey: string) {
  const dayValue = Number(dateKey.split("-")[2]);

  if (!Number.isInteger(dayValue) || dayValue < 1 || dayValue > 31) {
    return "";
  }

  return String(dayValue);
}

export function formatSlotDuration(startsAt: string, endsAt: string) {
  const durationMinutes = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / (1000 * 60));
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} h ${minutes} min`;
  }

  if (hours > 0) {
    return `${hours} h`;
  }

  return `${minutes} min`;
}

export function getSlotDurationMinutes(slot: PublicBookingCatalog["slots"][number]) {
  return (new Date(slot.endsAt).getTime() - new Date(slot.startsAt).getTime()) / (1000 * 60);
}

export function getCategoryKey(categoryName: string) {
  return categoryName.toLocaleLowerCase("cs-CZ");
}

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  const hasInternationalPrefix = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/\D/g, "");

  if (digitsOnly.length === 0) {
    return "";
  }

  return `${hasInternationalPrefix ? "+" : ""}${digitsOnly}`;
}

function validateFullName(value: string) {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return "Vyplňte prosím jméno a příjmení.";
  }

  if (trimmed.length < 3 || trimmed.replace(/[^\p{L}]/gu, "").length < 2) {
    return "Zadejte celé jméno a příjmení.";
  }

  return undefined;
}

function validateEmail(value: string) {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return "Vyplňte prosím e-mail.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "Zadejte platný e-mail.";
  }

  return undefined;
}

function validatePhone(value: string) {
  const normalized = normalizePhone(value);

  if (!normalized) {
    return undefined;
  }

  if (!/^\+?\d{8,15}$/.test(normalized)) {
    return "Telefon zadejte s 8 až 15 číslicemi, případně s úvodním +.";
  }

  return undefined;
}

export function buildContactFieldErrors(values: Record<ContactFieldKey, string>) {
  return {
    fullName: validateFullName(values.fullName),
    email: validateEmail(values.email),
    phone: validatePhone(values.phone),
  };
}
