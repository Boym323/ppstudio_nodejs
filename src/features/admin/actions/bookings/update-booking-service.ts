"use server";


import { revalidatePath } from "next/cache";
import { z } from "zod";

import { type AdminArea } from "@/config/navigation";







import { type BookingServiceChangePreview, type UpdateBookingServiceActionState } from "@/features/admin/actions/update-booking-service-action-state";

import {


  updateAdminBookingService,
  previewAdminBookingServiceChange,

} from "@/features/admin/lib/admin-booking";
import { getBookingStatusLabel } from "@/features/booking/lib/booking-status-presentation";
import {



} from "@/features/booking/domain/booking-status-transition";
import {





} from "@/features/booking/lib/booking-public";
import {



} from "@/features/booking/lib/booking-rescheduling";

import {




} from "@/features/vouchers/lib/voucher-redemption";








import {


  readFormString,
  revalidateBookingAdminPaths,


  resolveBookingActorUserId,


} from "./shared";

const updateBookingServiceSchema = z.object({
  allowManualOverride: z.boolean(),
  area: z.enum(["owner", "salon"]),
  bookingId: z.string().trim().min(1).max(64),
  serviceId: z.string().trim().min(1, "Vyberte novou službu.").max(64),
  expectedUpdatedAt: z.string().trim().min(1).max(64),
  reason: z.string().trim().max(300, "Důvod změny je příliš dlouhý.").optional().or(z.literal("")),
});


export async function updateBookingServiceAction(
  _previousState: UpdateBookingServiceActionState,
  formData: FormData,
): Promise<UpdateBookingServiceActionState> {
  const parsed = updateBookingServiceSchema.safeParse({
    allowManualOverride: readFormString(formData, "allowManualOverride") === "1",
    area: readFormString(formData, "area"),
    bookingId: readFormString(formData, "bookingId"),
    serviceId: readFormString(formData, "serviceId"),
    expectedUpdatedAt: readFormString(formData, "expectedUpdatedAt"),
    reason: readFormString(formData, "reason"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Změnu služby je potřeba doplnit nebo opravit.",
      fieldErrors: {
        serviceId: fieldErrors.serviceId?.[0],
        reason: fieldErrors.reason?.[0],
      },
    };
  }

  const area = parsed.data.area as AdminArea;
  const actorUserId = await resolveBookingActorUserId(area);
  const result = await updateAdminBookingService({
    allowManualOverride: parsed.data.allowManualOverride,
    bookingId: parsed.data.bookingId,
    serviceId: parsed.data.serviceId,
    actorUserId,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
    reason: parsed.data.reason || null,
  });

  if (result.status !== "success") return getBookingServiceChangeError(result);

  revalidateBookingAdminPaths(parsed.data.bookingId);
  revalidatePath(`/admin/klienti/${result.clientId}`);
  revalidatePath(`/admin/provoz/klienti/${result.clientId}`);

  const durationChanged = result.previousScheduledEndsAt.getTime() !== result.nextScheduledEndsAt.getTime();
  const cleanupChanged = result.previousCleanupBlockMinutes !== result.nextCleanupBlockMinutes;
  const keptPriceNotice = result.keptFinalPriceCzk !== null
    ? " Individuální finální cena rezervace zůstala beze změny."
    : "";

  return {
    status: "success",
    successMessage:
      `Služba byla změněná z „${result.previousServiceName}“ na „${result.nextServiceName}“.`
      + `${durationChanged || cleanupChanged ? " Termín rezervace byl přepočítaný podle nové délky služby." : ""}`
      + `${result.createdManualOverride ? " Prodloužení bylo uložené jako interní výjimka mimo vypsané termíny." : ""}`
      + keptPriceNotice,
  };
}


function getBookingServiceChangeError(
  result: Exclude<Awaited<ReturnType<typeof updateAdminBookingService>>, { status: "success" }>,
): UpdateBookingServiceActionState {
  if (result.status === "not-found") {
    return {
      status: "error",
      formError: "Rezervaci se nepodařilo najít.",
    };
  }

  if (result.status === "status-not-allowed") {
    return {
      status: "error",
      formError: `Službu lze měnit jen u čekajících a potvrzených rezervací. Aktuální stav je „${getBookingStatusLabel(result.currentStatus)}“.`,
    };
  }

  if (result.status === "concurrent-modification") {
    return {
      status: "error",
      formError: "Rezervace se mezitím změnila v jiném okně. Obnovte detail a zkuste to znovu.",
    };
  }

  if (result.status === "same-service") {
    return {
      status: "error",
      formError: "Vybraná služba je stejná jako ta aktuální.",
      fieldErrors: {
        serviceId: "Vyberte jinou službu.",
      },
    };
  }

  if (result.status === "service-not-found") {
    return {
      status: "error",
      formError: "Vybranou službu se nepodařilo načíst. Zkuste detail obnovit.",
      fieldErrors: {
        serviceId: "Vybraná služba už není dostupná.",
      },
    };
  }

  if (result.status === "voucher-conflict") {
    return {
      status: "error",
      formError: result.message,
    };
  }

  if (result.status === "slot-too-short") {
    return {
      status: "error",
      formError: result.message,
      fieldErrors: {
        serviceId: "Vybraná služba vyžaduje jiný termín nebo jiný povolený slot.",
      },
    };
  }

  if (result.status === "slot-unavailable") {
    return {
      status: "error",
      formError: "Vybraný termín už není dostupný. Nová délka služby by znemožnila automatický oběd; nejprve upravte termín rezervace.",
      fieldErrors: {
        serviceId: "Vybraná služba by v tomto termínu znemožnila automatický oběd.",
      },
    };
  }

  if (result.status === "conflict") {
    return {
      status: "error",
      formError: result.message,
      fieldErrors: {
        serviceId: "Vybraná služba se v tomto čase nevejde kvůli kolizi.",
      },
    };
  }

  throw new Error("Neznámý výsledek změny služby.");
}

export async function previewBookingServiceChangeAction(input: {
  area: AdminArea;
  bookingId: string;
  serviceId: string;
  expectedUpdatedAt: string;
}): Promise<BookingServiceChangePreview> {
  const parsed = updateBookingServiceSchema.safeParse({ ...input, allowManualOverride: true });
  if (!parsed.success) return { status: "blocked", message: "Vyberte platnou službu nebo obnovte detail rezervace." };

  const actorUserId = await resolveBookingActorUserId(parsed.data.area);
  const result = await previewAdminBookingServiceChange({
    bookingId: parsed.data.bookingId,
    serviceId: parsed.data.serviceId,
    expectedUpdatedAt: parsed.data.expectedUpdatedAt,
    actorUserId,
  });
  if (result.status === "slot-too-short") {
    return {
      status: "blocked",
      message: result.reason === "service-restriction"
        ? result.message
        : "Pro tuto službu chybí platná dostupnost a změnu nelze povolit jako prodloužení. Upravte termín rezervace.",
    };
  }
  if (result.status !== "success") {
    return { status: "blocked", message: getBookingServiceChangeError(result).formError ?? "Změnu služby nelze provést." };
  }

  return {
    status: result.createdManualOverride ? "requires-override" : "ready",
    message: result.createdManualOverride
      ? "Pro delší návštěvu není souvisle vypsaná dostupnost. Potvrzením povolíte prodloužení jako interní výjimku pouze pro tuto rezervaci."
      : "Změnu lze uložit bez potvrzování další výjimky.",
    serviceEndsAt: result.nextScheduledEndsAt.toISOString(),
    blockedUntil: result.nextBlockedUntil.toISOString(),
    cleanupBlockMinutes: result.nextCleanupBlockMinutes,
  };
}
