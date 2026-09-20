"use server";

import { AdminRole } from "@/generated/prisma/browser";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { type AdminArea } from "@/config/navigation";
import {
  getAdminVoucherActivationHref,
  getAdminVoucherStockBatchHref,
  getAdminVoucherStockHref,
} from "@/features/admin/lib/admin-voucher-stock";
import {
  type CreateVoucherPrintBatchState,
  type VoucherStockActivationState,
  type VoucherStockLookupState,
} from "@/features/admin/actions/voucher-stock-action-state";
import {
  activateVoucherStockItem,
  createVoucherPrintBatch,
  findVoucherStockItemByCode,
  receiveVoucherPrintBatch,
  voidVoucherStockItem,
  closeVoucherPrintBatch,
  VoucherStockOperationError,
  voucherStockOperationErrorCodes,
} from "@/features/vouchers/lib/voucher-stock";
import { normalizeVoucherCode } from "@/features/vouchers/lib/voucher-code";
import { activateVoucherStockItemSchema } from "@/features/vouchers/schemas/voucher-schemas";
import { requireRole } from "@/lib/auth/session";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function resolveArea(role: AdminRole, value: string): AdminArea {
  return role === AdminRole.SALON ? "salon" : value === "salon" ? "salon" : "owner";
}

function domainErrorMessage(error: unknown) {
  if (!(error instanceof VoucherStockOperationError)) {
    return null;
  }

  switch (error.code) {
    case voucherStockOperationErrorCodes.itemNotFound:
      return "Předtištěný voucher nebyl nalezen.";
    case voucherStockOperationErrorCodes.itemNotAvailable:
      return "Voucher není dostupný k aktivaci.";
    case voucherStockOperationErrorCodes.itemVoided:
      return "Znehodnocený voucher nelze aktivovat.";
    case voucherStockOperationErrorCodes.serviceNotActive:
      return "Vybraná služba už není aktivní.";
    case voucherStockOperationErrorCodes.servicePriceMissing:
      return "Vybraná služba nemá nastavenou cenu a nelze ji použít pro voucher.";
    case voucherStockOperationErrorCodes.templateNotAllowed:
      return "Tento vzhled nepodporuje vybraný typ voucheru.";
    case voucherStockOperationErrorCodes.invalidValidityRange:
      return "Platnost do musí být po datu aktivace.";
    case voucherStockOperationErrorCodes.batchNotFound:
      return "Tisková série nebyla nalezena.";
    case voucherStockOperationErrorCodes.batchClosed:
      return "Uzavřená tisková série už nejde měnit.";
    case voucherStockOperationErrorCodes.itemAlreadyActivated:
      return "Aktivovaný voucher nelze znehodnotit.";
    case voucherStockOperationErrorCodes.voidReasonRequired:
      return "Důvod znehodnocení je povinný.";
    case voucherStockOperationErrorCodes.transientConflict:
      return "Operaci se kvůli souběžné změně nepodařilo dokončit. Zkuste ji prosím znovu.";
    default:
      return error.message;
  }
}

const createBatchSchema = z.object({
  templateKey: z.string().trim().min(1, "Vyberte vzhled voucheru.").max(128),
  quantity: z.coerce.number().int("Počet musí být celé číslo.").min(1, "Počet musí být alespoň 1.").max(500, "Maximum je 500 kusů."),
});

export async function createVoucherPrintBatchAction(
  _previousState: CreateVoucherPrintBatchState,
  formData: FormData,
): Promise<CreateVoucherPrintBatchState> {
  const session = await requireRole([AdminRole.OWNER]);
  const parsed = createBatchSchema.safeParse({
    templateKey: readFormString(formData, "templateKey"),
    quantity: readFormString(formData, "quantity"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      status: "error",
      formError: "Tiskovou sérii je potřeba ještě doplnit.",
      fieldErrors: {
        templateKey: fieldErrors.templateKey?.[0],
        quantity: fieldErrors.quantity?.[0],
      },
    };
  }

  let batch: Awaited<ReturnType<typeof createVoucherPrintBatch>>;
  try {
    batch = await createVoucherPrintBatch({
      templateKey: parsed.data.templateKey,
      quantity: parsed.data.quantity,
      createdByUserId: session.sub,
    });
  } catch (error) {
    const message = domainErrorMessage(error);
    if (message) {
      return { status: "error", formError: message };
    }

    return { status: "error", formError: "Tiskovou sérii se nepodařilo vytvořit. Zkuste to prosím znovu." };
  }

  revalidatePath(getAdminVoucherStockHref("owner"));
  redirect(getAdminVoucherStockBatchHref("owner", batch.id));
}

export async function lookupVoucherStockItemAction(
  _previousState: VoucherStockLookupState,
  formData: FormData,
): Promise<VoucherStockLookupState> {
  await requireRole([AdminRole.OWNER, AdminRole.SALON]);
  const code = normalizeVoucherCode(readFormString(formData, "code"));
  if (!code) {
    return { status: "error", formError: "Zadejte kód voucheru." };
  }

  const item = await findVoucherStockItemByCode(code);
  return item ? { status: "found", item } : { status: "not_found", formError: "Předtištěný voucher nebyl nalezen." };
}

export async function activateVoucherStockItemAction(
  _previousState: VoucherStockActivationState,
  formData: FormData,
): Promise<VoucherStockActivationState> {
  const session = await requireRole([AdminRole.OWNER, AdminRole.SALON]);
  const type = readFormString(formData, "type");
  const parsed = activateVoucherStockItemSchema.safeParse({
    code: readFormString(formData, "code"),
    type,
    originalValueCzk: type === "VALUE" ? readFormString(formData, "originalValueCzk") : undefined,
    serviceId: type === "SERVICE" ? readFormString(formData, "serviceId") : undefined,
    validFrom: readFormString(formData, "validFrom"),
    validUntil: readFormString(formData, "validUntil"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      status: "error",
      formError: "Aktivaci je potřeba ještě doplnit nebo opravit.",
      fieldErrors: {
        code: fieldErrors.code?.[0],
        type: fieldErrors.type?.[0],
        originalValueCzk: fieldErrors.originalValueCzk?.[0],
        serviceId: fieldErrors.serviceId?.[0],
        validFrom: fieldErrors.validFrom?.[0],
        validUntil: fieldErrors.validUntil?.[0],
      },
    };
  }

  try {
    const result = await activateVoucherStockItem({ ...parsed.data, actorUserId: session.sub });
    const area = resolveArea(session.role, readFormString(formData, "area"));
    revalidatePath(getAdminVoucherStockHref(area));
    revalidatePath(getAdminVoucherActivationHref(area));
    revalidatePath("/vouchery/overeni");

    if (result.kind === "already_activated") {
      return { status: "already_activated", voucherId: result.voucherId, code: result.code };
    }

    revalidatePath(area === "owner" ? `/admin/vouchery/${result.voucherId}` : `/admin/provoz/vouchery/${result.voucherId}`);
    return {
      status: "success",
      voucherId: result.voucherId,
      code: result.code,
      type: result.type,
      originalValueCzk: result.originalValueCzk,
      serviceNameSnapshot: result.serviceNameSnapshot,
      servicePriceSnapshotCzk: result.servicePriceSnapshotCzk,
      validFrom: result.validFrom,
      validUntil: result.validUntil,
    };
  } catch (error) {
    if (error instanceof VoucherStockOperationError && error.code === voucherStockOperationErrorCodes.itemAlreadyActivated) {
      return { status: "already_activated", code: normalizeVoucherCode(readFormString(formData, "code")), formError: "Tento voucher byl již aktivován." };
    }

    const message = domainErrorMessage(error);
    return { status: "error", formError: message ?? "Voucher se teď nepodařilo aktivovat. Zkuste to prosím znovu." };
  }
}

export async function receiveVoucherPrintBatchAction(formData: FormData) {
  const session = await requireRole([AdminRole.OWNER]);
  const batchId = readFormString(formData, "batchId");
  await receiveVoucherPrintBatch({ batchId, actorUserId: session.sub });
  revalidatePath(getAdminVoucherStockHref("owner"));
  revalidatePath(getAdminVoucherStockBatchHref("owner", batchId));
}

export async function closeVoucherPrintBatchAction(formData: FormData) {
  const session = await requireRole([AdminRole.OWNER]);
  const batchId = readFormString(formData, "batchId");
  await closeVoucherPrintBatch({ batchId, actorUserId: session.sub });
  revalidatePath(getAdminVoucherStockHref("owner"));
  revalidatePath(getAdminVoucherStockBatchHref("owner", batchId));
}

export async function voidVoucherStockItemAction(formData: FormData) {
  const session = await requireRole([AdminRole.OWNER, AdminRole.SALON]);
  const area = resolveArea(session.role, readFormString(formData, "area"));
  const stockItemId = readFormString(formData, "stockItemId");
  await voidVoucherStockItem({
    stockItemId,
    actorUserId: session.sub,
    reason: readFormString(formData, "reason"),
  });
  const batchId = readFormString(formData, "batchId");
  revalidatePath(getAdminVoucherStockHref(area));
  revalidatePath(getAdminVoucherStockBatchHref(area, batchId));
}
