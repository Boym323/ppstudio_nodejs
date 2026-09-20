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
  type VoucherStockMutationActionState,
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

type VoucherStockOperationErrorCode =
  (typeof voucherStockOperationErrorCodes)[keyof typeof voucherStockOperationErrorCodes];

const voucherStockDomainMessages: Record<VoucherStockOperationErrorCode, string> = {
  [voucherStockOperationErrorCodes.batchNotFound]: "Tisková série nebyla nalezena.",
  [voucherStockOperationErrorCodes.itemNotFound]: "Předtištěný voucher nebyl nalezen.",
  [voucherStockOperationErrorCodes.invalidQuantity]: "Počet kusů musí být celé číslo od 1 do 500.",
  [voucherStockOperationErrorCodes.invalidTemplate]: "Vybraný vzhled voucheru neexistuje.",
  [voucherStockOperationErrorCodes.templateUnavailable]: "Vybraný vzhled není dostupný pro nové tiskové série.",
  [voucherStockOperationErrorCodes.templateNotAllowed]: "Tento vzhled nepodporuje vybraný typ voucheru.",
  [voucherStockOperationErrorCodes.batchAlreadyReceived]: "Tisková série už byla převzata.",
  [voucherStockOperationErrorCodes.batchClosed]: "Uzavřená tisková série už nejde měnit.",
  [voucherStockOperationErrorCodes.itemNotAvailable]: "Voucher není dostupný k aktivaci.",
  [voucherStockOperationErrorCodes.itemAlreadyActivated]: "Aktivovaný voucher nelze znehodnotit.",
  [voucherStockOperationErrorCodes.itemVoided]: "Znehodnocený voucher nelze aktivovat.",
  [voucherStockOperationErrorCodes.serviceNotActive]: "Vybraná služba už není aktivní.",
  [voucherStockOperationErrorCodes.servicePriceMissing]: "Vybraná služba nemá nastavenou cenu a nelze ji použít pro voucher.",
  [voucherStockOperationErrorCodes.invalidValidityRange]: "Platnost do musí být po datu aktivace.",
  [voucherStockOperationErrorCodes.integrityError]: "Voucher má nekonzistentní data. Obnovte stránku nebo kontaktujte správce.",
  [voucherStockOperationErrorCodes.transientConflict]: "Operaci se kvůli souběžné změně nepodařilo dokončit. Zkuste ji prosím znovu.",
  [voucherStockOperationErrorCodes.operationFailed]: "Operaci se nepodařilo dokončit. Zkuste ji prosím znovu.",
  [voucherStockOperationErrorCodes.voidReasonRequired]: "Důvod znehodnocení je povinný.",
  [voucherStockOperationErrorCodes.itemNotReceived]: "Položku lze znehodnotit až po převzetí série.",
};

function domainErrorMessage(error: unknown) {
  if (!(error instanceof VoucherStockOperationError)) {
    return null;
  }

  return voucherStockDomainMessages[error.code];
}

function logUnexpectedVoucherStockActionError(operation: string, formData: FormData, error: unknown) {
  console.error("Voucher Stock admin action failed", {
    operation,
    batchId: readFormString(formData, "batchId") || undefined,
    stockItemId: readFormString(formData, "stockItemId") || undefined,
    area: readFormString(formData, "area") || undefined,
    error,
  });
}

function voucherStockMutationErrorState(
  operation: string,
  formData: FormData,
  error: unknown,
  fallbackMessage: string,
): VoucherStockMutationActionState {
  const message = domainErrorMessage(error);
  if (message) {
    return { status: "error", formError: message };
  }

  logUnexpectedVoucherStockActionError(operation, formData, error);
  return { status: "error", formError: fallbackMessage };
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

export async function receiveVoucherPrintBatchAction(
  _previousState: VoucherStockMutationActionState,
  formData: FormData,
): Promise<VoucherStockMutationActionState> {
  const session = await requireRole([AdminRole.OWNER]);
  const batchId = readFormString(formData, "batchId");
  try {
    await receiveVoucherPrintBatch({ batchId, actorUserId: session.sub });
    revalidatePath(getAdminVoucherStockHref("owner"));
    revalidatePath(getAdminVoucherStockBatchHref("owner", batchId));
    return { status: "success" };
  } catch (error) {
    return voucherStockMutationErrorState("receiveVoucherPrintBatch", formData, error, "Sérii se teď nepodařilo převzít. Zkuste to prosím znovu.");
  }
}

export async function closeVoucherPrintBatchAction(
  _previousState: VoucherStockMutationActionState,
  formData: FormData,
): Promise<VoucherStockMutationActionState> {
  const session = await requireRole([AdminRole.OWNER]);
  const batchId = readFormString(formData, "batchId");
  try {
    await closeVoucherPrintBatch({ batchId, actorUserId: session.sub });
    revalidatePath(getAdminVoucherStockHref("owner"));
    revalidatePath(getAdminVoucherStockBatchHref("owner", batchId));
    return { status: "success" };
  } catch (error) {
    return voucherStockMutationErrorState("closeVoucherPrintBatch", formData, error, "Sérii se teď nepodařilo uzavřít. Zkuste to prosím znovu.");
  }
}

export async function voidVoucherStockItemAction(
  _previousState: VoucherStockMutationActionState,
  formData: FormData,
): Promise<VoucherStockMutationActionState> {
  const session = await requireRole([AdminRole.OWNER, AdminRole.SALON]);
  const area = resolveArea(session.role, readFormString(formData, "area"));
  const stockItemId = readFormString(formData, "stockItemId");
  try {
    await voidVoucherStockItem({
      stockItemId,
      actorUserId: session.sub,
      reason: readFormString(formData, "reason"),
    });
    const batchId = readFormString(formData, "batchId");
    revalidatePath(getAdminVoucherStockHref(area));
    revalidatePath(getAdminVoucherStockBatchHref(area, batchId));
    return { status: "success" };
  } catch (error) {
    return voucherStockMutationErrorState("voidVoucherStockItem", formData, error, "Položku se teď nepodařilo znehodnotit. Zkuste to prosím znovu.");
  }
}
