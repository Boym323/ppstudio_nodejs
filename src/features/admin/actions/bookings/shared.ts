import { AdminRole } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

import { type AdminArea } from "@/config/navigation";
import { requireAdminArea } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { resolvePragueLocalDateTime } from "@/features/booking/lib/booking-local-time";
import { VoucherRedemptionError, voucherRedemptionErrorCodes } from "@/features/vouchers/lib/voucher-redemption";

export function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

export function revalidateBookingAdminPaths(bookingId: string) {
  const paths = [
    "/admin",
    "/admin/rezervace",
    `/admin/rezervace/${bookingId}`,
    "/admin/provoz",
    "/admin/provoz/rezervace",
    `/admin/provoz/rezervace/${bookingId}`,
  ];

  for (const path of paths) {
    revalidatePath(path);
  }
}

export async function resolveBookingActorUserId(area: AdminArea) {
  const session = await requireAdminArea(area);
  const dbUser = await prisma.adminUser.findFirst({
    where: {
      email: {
        equals: session.email.trim(),
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  return dbUser?.id ?? null;
}

export async function resolveVoucherRedemptionActorUserId(email: string) {
  const dbUser = await prisma.adminUser.findFirst({
    where: {
      email: {
        equals: email.trim(),
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  return dbUser?.id ?? null;
}

export function resolveActionArea(role: AdminRole, requestedArea: AdminArea): AdminArea {
  if (role === AdminRole.SALON) {
    return "salon";
  }

  return requestedArea;
}

export function getVoucherRedemptionFormError(error: VoucherRedemptionError) {
  switch (error.code) {
    case voucherRedemptionErrorCodes.voucherNotFound:
      return "Voucher s tímto kódem se nepodařilo najít.";
    case voucherRedemptionErrorCodes.bookingNotFound:
      return "Rezervaci se nepodařilo najít.";
    case voucherRedemptionErrorCodes.bookingAlreadyRedeemed:
      return "Na této rezervaci už je voucher uplatněný. Další voucher už nejde přidat.";
    case voucherRedemptionErrorCodes.voucherNotRedeemable:
      return "Voucher teď nejde uplatnit. Zkontrolujte jeho stav a platnost.";
    case voucherRedemptionErrorCodes.amountRequired:
      return "U hodnotového voucheru zadejte částku k uplatnění.";
    case voucherRedemptionErrorCodes.insufficientRemainingValue:
      return "Voucher nemá tak vysoký zůstatek. Zadejte maximálně zbývající hodnotu voucheru; zbytek ceny se doplatí mimo voucher.";
    case voucherRedemptionErrorCodes.serviceMismatch:
      return "Tento voucher je vystavený na jinou službu než aktuální rezervace.";
    case voucherRedemptionErrorCodes.concurrentRedemption:
      return "Voucher se mezitím změnil. Obnovte detail rezervace a zkuste to znovu.";
    default:
      return "Voucher se nepodařilo uplatnit. Zkontrolujte kód a zkuste to znovu.";
  }
}

const czkFormatter = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 0,
  style: "currency",
  currency: "CZK",
});

function formatCzk(value: number) {
  return czkFormatter.format(value);
}

export function getVoucherRedemptionSuccessMessage(
  area: AdminArea,
  requestedAmountCzk: number | undefined,
  redeemedAmountCzk: number | null,
) {
  if (
    typeof requestedAmountCzk === "number"
    && typeof redeemedAmountCzk === "number"
    && redeemedAmountCzk < requestedAmountCzk
  ) {
    const remainingAmountCzk = requestedAmountCzk - redeemedAmountCzk;

    return `Voucher je uplatněný ve výši ${formatCzk(redeemedAmountCzk)}. Nepokrývá celou zadanou částku; zbývá doplatek ${formatCzk(remainingAmountCzk)} mimo voucher.`;
  }

  return area === "salon"
    ? "Voucher je uplatněný a propsal se do detailu rezervace."
    : "Voucher je uplatněný a historie rezervace je aktuální.";
}

export function resolveManualStartsAt(dateValue: string, timeValue: string) {
  return resolvePragueLocalDateTime(dateValue, timeValue);
}

export function revalidateManualBookingPaths(bookingId: string, clientId?: string) {
  revalidateBookingAdminPaths(bookingId);
  revalidatePath("/rezervace");
  revalidatePath("/admin/volne-terminy");
  revalidatePath("/admin/provoz/volne-terminy");

  if (clientId) {
    revalidatePath(`/admin/klienti/${clientId}`);
    revalidatePath(`/admin/provoz/klienti/${clientId}`);
  }
}
