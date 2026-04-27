"use server";

import { AdminRole, VoucherType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type AdminArea } from "@/config/navigation";
import { type CreateVoucherActionState } from "@/features/admin/actions/create-voucher-action-state";
import {
  getAdminVoucherHref,
  getAdminVouchersHref,
} from "@/features/admin/lib/admin-vouchers";
import { createVoucher } from "@/features/vouchers/actions/voucher-actions";
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
