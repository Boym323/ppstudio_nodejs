import { VoucherType } from "@prisma/client";

import type { AdminBookingDetailData } from "@/features/admin/lib/admin-booking";

export type BookingStatusContext = {
  title: string;
  description: string;
  tone: "pending" | "confirmed" | "closed" | "neutral";
};

const czkFormatter = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 0,
  style: "currency",
  currency: "CZK",
});

export function formatCzk(value: number | null | undefined) {
  return typeof value === "number" ? czkFormatter.format(value) : "Bez částky";
}

export function formatDurationLabel(durationMinutes: number) {
  return `${durationMinutes} min`;
}

export function getPriceDifferenceLabel(adjustmentCzk: number) {
  if (adjustmentCzk < 0) {
    return `Sleva ${formatCzk(Math.abs(adjustmentCzk))}`;
  }

  if (adjustmentCzk > 0) {
    return `Navýšení ${formatCzk(adjustmentCzk)}`;
  }

  return "Bez úpravy";
}

export function getVoucherAmountHint(
  voucher: AdminBookingDetailData["voucher"]["intendedVoucher"],
  remainingAmountCzk: number | null,
) {
  if (!voucher || voucher.type !== VoucherType.VALUE) {
    return null;
  }

  const remainingValueCzk = voucher.remainingValueCzk ?? 0;

  if (remainingValueCzk <= 0 || remainingAmountCzk === null || remainingValueCzk >= remainingAmountCzk) {
    return null;
  }

  return `Voucher pokryje maximálně ${formatCzk(remainingValueCzk)}. Zbytek ceny služby se doplatí mimo voucher.`;
}

export function getStatusContext(data: AdminBookingDetailData): BookingStatusContext {
  if (data.availableActions.length === 0) {
    switch (data.status) {
      case "COMPLETED":
        return {
          title: "Rezervace je uzavřená jako hotová.",
          description: "Detail teď slouží hlavně pro kontrolu poznámek a historie.",
          tone: "closed",
        };
      case "CANCELLED":
        return {
          title: "Rezervace je zrušená.",
          description: "Žádná další provozní akce není potřeba.",
          tone: "closed",
        };
      case "NO_SHOW":
        return {
          title: "Rezervace je uzavřená jako nedorazila.",
          description: "Historie zůstává po ruce a interní poznámku můžeš dál upravit.",
          tone: "closed",
        };
      default:
        return {
          title: "Rezervace je bez další akce.",
          description: "Detail zůstává jako rychlý přehled a auditní stopa.",
          tone: "neutral",
        };
    }
  }

  switch (data.status) {
    case "PENDING":
      return {
        title: "Rezervace čeká na rozhodnutí.",
        description: "Nejčastější krok je potvrzení. Ostatní akce jsou hned vedle.",
        tone: "pending",
      };
    case "CONFIRMED":
      return {
        title: "Potvrzený termín · Po návštěvě zapiš úhradu a dokonči návštěvu.",
        description: "Po návštěvě uzavři rezervaci jako hotovou, případně označ jako nedorazila.",
        tone: "confirmed",
      };
    default:
      return {
        title: "Vyber další krok.",
        description: "Akce níže používají existující stavová pravidla i audit.",
        tone: "neutral",
      };
  }
}
