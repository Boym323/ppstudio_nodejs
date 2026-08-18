"use server";

import { AdminRole } from "@/generated/prisma/browser";
import { revalidatePath } from "next/cache";

import { type AdminArea } from "@/config/navigation";
import { type SendVoucherEmailActionState } from "@/features/admin/actions/send-voucher-email-action-state";
import {
  getAdminVoucherHref,
  getAdminVouchersHref,
} from "@/features/admin/lib/admin-vouchers";
import { queueVoucherEmailLog } from "@/features/admin/lib/voucher-email-queue";
import { requireRole } from "@/lib/auth/session";
import { sendOwnerSystemErrorPushover } from "@/lib/notifications/pushover";

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

export async function sendVoucherEmailAction(
  _previousState: SendVoucherEmailActionState,
  formData: FormData,
): Promise<SendVoucherEmailActionState> {
  const session = await requireRole([AdminRole.OWNER, AdminRole.SALON]);
  const area = resolveActionArea(session.role, readArea(readFormString(formData, "area")));

  try {
    const result = await queueVoucherEmailLog({
      voucherId: readFormString(formData, "voucherId"),
      recipientEmail: readFormString(formData, "recipientEmail"),
      subject: readFormString(formData, "subject"),
    });

    if (result.status === "error") {
      return {
        status: "error",
        formError: result.formError,
        fieldErrors: result.fieldErrors,
      };
    }

    revalidatePath(getAdminVoucherHref(area, result.voucherId));
    revalidatePath(getAdminVouchersHref(area));
    revalidatePath("/admin/email-logy");

    return {
      status: "success",
      successMessage:
        result.emailDeliveryStatus === "queued"
          ? "Voucher e-mail byl zařazen do fronty. Worker ho odešle při dalším průchodu."
          : "Voucher e-mail byl úspěšně zalogovaný v log režimu.",
    };
  } catch (error) {
    console.error("Failed to queue voucher email", error);

    await sendOwnerSystemErrorPushover({
      title: "PP Studio - systemova chyba",
      message: "Rucni odeslani voucher emailu se nepodarilo zalozit do fronty.",
      context: {
        contextId: readFormString(formData, "voucherId") || "admin-voucher-email",
        voucherId: readFormString(formData, "voucherId") || null,
      },
      error,
    });

    return {
      status: "error",
      formError: "Voucher e-mail se teď nepodařilo odeslat. Zkuste to prosím znovu.",
    };
  }
}
