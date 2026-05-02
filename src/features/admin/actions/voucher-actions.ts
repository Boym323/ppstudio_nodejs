"use server";

import { AdminRole, VoucherType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { type AdminArea } from "@/config/navigation";
import { type CancelVoucherActionState } from "@/features/admin/actions/cancel-voucher-action-state";
import { type CreateVoucherActionState } from "@/features/admin/actions/create-voucher-action-state";
import { type UpdateVoucherOperationalDetailsActionState } from "@/features/admin/actions/update-voucher-operational-details-action-state";
import {
  getAdminVoucherHref,
  getAdminVouchersHref,
} from "@/features/admin/lib/admin-vouchers";
import { createVoucher } from "@/features/vouchers/lib/voucher-management";
import {
  cancelVoucherOperationally,
  updateVoucherOperationalDetails,
  VoucherOperationError,
  voucherOperationErrorCodes,
} from "@/features/vouchers/lib/voucher-operations";
import { createVoucherSchema } from "@/features/vouchers/schemas/voucher-schemas";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function readArea(value: string): AdminArea {
  return value === "salon" ? "salon" : "owner";
}

function resolveActionArea(role: AdminRole, requestedArea: AdminArea): AdminArea {
  if (role === AdminRole.SALON) {
    return "salon";
  }

  return requestedArea;
}

async function resolveVoucherActorUserId(email: string) {
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

const optionalText = (maxLength: number, message: string) =>
  z
    .string()
    .trim()
    .max(maxLength, message)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || undefined);

const optionalOperationalDate = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.date("Datum platnosti není platné.").optional(),
);

const updateVoucherOperationalDetailsSchema = z.object({
  area: z.enum(["owner", "salon"]),
  voucherId: z.string().trim().min(1, "Voucher je potřeba vybrat.").max(64),
  purchaserName: optionalText(160, "Jméno kupujícího je příliš dlouhé."),
  purchaserEmail: optionalText(240, "E-mail kupujícího je příliš dlouhý.").pipe(
    z.email("E-mail kupujícího není platný.").optional(),
  ),
  validUntil: optionalOperationalDate,
  internalNote: optionalText(2000, "Interní poznámka je příliš dlouhá."),
});

const cancelVoucherSchema = z.object({
  area: z.enum(["owner", "salon"]),
  voucherId: z.string().trim().min(1, "Voucher je potřeba vybrat.").max(64),
  cancelReason: z
    .string()
    .trim()
    .min(3, "Důvod zrušení musí mít alespoň 3 znaky.")
    .max(500, "Důvod zrušení může mít maximálně 500 znaků."),
});

function revalidateVoucherPaths(area: AdminArea, voucherId: string) {
  revalidatePath(getAdminVoucherHref(area, voucherId));
  revalidatePath(getAdminVouchersHref(area));
  revalidatePath("/admin/vouchery");
  revalidatePath("/admin/provoz/vouchery");
  revalidatePath("/vouchery/overeni");
}

export async function createAdminVoucherAction(
  _previousState: CreateVoucherActionState,
  formData: FormData,
): Promise<CreateVoucherActionState> {
  const session = await requireRole([AdminRole.OWNER, AdminRole.SALON]);
  const area = resolveActionArea(session.role, readArea(readFormString(formData, "area")));
  const type = readFormString(formData, "type");
  const parsed = createVoucherSchema.safeParse({
    type,
    originalValueCzk: type === VoucherType.VALUE ? readFormString(formData, "originalValueCzk") : undefined,
    serviceId: type === VoucherType.SERVICE ? readFormString(formData, "serviceId") : undefined,
    validFrom: readFormString(formData, "validFrom"),
    validUntil: readFormString(formData, "validUntil"),
    purchaserName: readFormString(formData, "purchaserName"),
    purchaserEmail: readFormString(formData, "purchaserEmail"),
    recipientName: readFormString(formData, "recipientName"),
    message: readFormString(formData, "message"),
    internalNote: readFormString(formData, "internalNote"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Voucher je potřeba ještě doplnit nebo opravit.",
      fieldErrors: {
        type: fieldErrors.type?.[0],
        originalValueCzk: fieldErrors.originalValueCzk?.[0],
        serviceId: fieldErrors.serviceId?.[0],
        validFrom: fieldErrors.validFrom?.[0],
        validUntil: fieldErrors.validUntil?.[0],
        purchaserName: fieldErrors.purchaserName?.[0],
        purchaserEmail: fieldErrors.purchaserEmail?.[0],
        recipientName: fieldErrors.recipientName?.[0],
        message: fieldErrors.message?.[0],
        internalNote: fieldErrors.internalNote?.[0],
      },
    };
  }

  if (parsed.data.type === VoucherType.SERVICE) {
    const service = await prisma.service.findFirst({
      where: {
        id: parsed.data.serviceId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!service) {
      return {
        status: "error",
        formError: "Vybraná služba už není aktivní.",
        fieldErrors: {
          serviceId: "Vyberte aktivní službu.",
        },
      };
    }
  }

  const actorUserId = await resolveVoucherActorUserId(session.email);
  const voucher = await createVoucher(parsed.data, actorUserId);

  revalidatePath(getAdminVouchersHref(area));
  redirect(getAdminVoucherHref(area, voucher.id));
}

export async function updateVoucherOperationalDetailsAction(
  _previousState: UpdateVoucherOperationalDetailsActionState,
  formData: FormData,
): Promise<UpdateVoucherOperationalDetailsActionState> {
  const session = await requireRole([AdminRole.OWNER, AdminRole.SALON]);
  const parsed = updateVoucherOperationalDetailsSchema.safeParse({
    area: readArea(readFormString(formData, "area")),
    voucherId: readFormString(formData, "voucherId"),
    purchaserName: readFormString(formData, "purchaserName"),
    purchaserEmail: readFormString(formData, "purchaserEmail"),
    validUntil: readFormString(formData, "validUntil"),
    internalNote: readFormString(formData, "internalNote"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Provozní údaje je potřeba ještě doplnit nebo opravit.",
      fieldErrors: {
        purchaserName: fieldErrors.purchaserName?.[0],
        purchaserEmail: fieldErrors.purchaserEmail?.[0],
        validUntil: fieldErrors.validUntil?.[0],
        internalNote: fieldErrors.internalNote?.[0],
      },
    };
  }

  const area = resolveActionArea(session.role, parsed.data.area);
  const actorUserId = await resolveVoucherActorUserId(session.email);

  try {
    await updateVoucherOperationalDetails({
      voucherId: parsed.data.voucherId,
      purchaserName: parsed.data.purchaserName,
      purchaserEmail: parsed.data.purchaserEmail,
      validUntil: parsed.data.validUntil ?? null,
      internalNote: parsed.data.internalNote,
      updatedByUserId: actorUserId,
    });
  } catch (error) {
    if (error instanceof VoucherOperationError && error.code === voucherOperationErrorCodes.voucherNotFound) {
      return {
        status: "error",
        formError: "Voucher se nepodařilo najít.",
      };
    }

    throw error;
  }

  revalidateVoucherPaths(area, parsed.data.voucherId);

  return {
    status: "success",
    successMessage: "Provozní údaje voucheru jsou uložené.",
  };
}

export async function cancelVoucherAction(
  _previousState: CancelVoucherActionState,
  formData: FormData,
): Promise<CancelVoucherActionState> {
  const session = await requireRole([AdminRole.OWNER, AdminRole.SALON]);
  const parsed = cancelVoucherSchema.safeParse({
    area: readArea(readFormString(formData, "area")),
    voucherId: readFormString(formData, "voucherId"),
    cancelReason: readFormString(formData, "cancelReason"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Zrušení voucheru je potřeba ještě doplnit.",
      fieldErrors: {
        cancelReason: fieldErrors.cancelReason?.[0],
      },
    };
  }

  const area = resolveActionArea(session.role, parsed.data.area);
  const actorUserId = await resolveVoucherActorUserId(session.email);

  try {
    await cancelVoucherOperationally({
      voucherId: parsed.data.voucherId,
      cancelReason: parsed.data.cancelReason,
      actorUserId,
    });
  } catch (error) {
    if (error instanceof VoucherOperationError) {
      if (error.code === voucherOperationErrorCodes.voucherNotFound) {
        return {
          status: "error",
          formError: "Voucher se nepodařilo najít.",
        };
      }

      if (error.code === voucherOperationErrorCodes.voucherAlreadyCancelled) {
        return {
          status: "error",
          formError: "Voucher už je zrušený.",
        };
      }

      if (error.code === voucherOperationErrorCodes.voucherHasRedemptions) {
        return {
          status: "error",
          formError: "Voucher už byl částečně nebo plně čerpán, proto ho nelze zrušit.",
        };
      }
    }

    throw error;
  }

  revalidateVoucherPaths(area, parsed.data.voucherId);

  return {
    status: "success",
    successMessage: "Voucher je zrušený a nepůjde uplatnit.",
  };
}
