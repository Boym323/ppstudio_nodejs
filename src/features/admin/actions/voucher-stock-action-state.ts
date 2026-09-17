import { VoucherType } from "@/generated/prisma/browser";
import { type findVoucherStockItemByCode } from "@/features/vouchers/lib/voucher-stock";

export type VoucherStockLookupItem = NonNullable<Awaited<ReturnType<typeof findVoucherStockItemByCode>>>;

export type VoucherStockLookupState = {
  status: "idle" | "found" | "not_found" | "error";
  item?: VoucherStockLookupItem;
  formError?: string;
};

export const initialVoucherStockLookupState: VoucherStockLookupState = { status: "idle" };

export type VoucherStockActivationState = {
  status: "idle" | "success" | "already_activated" | "error";
  voucherId?: string;
  code?: string;
  type?: VoucherType;
  originalValueCzk?: number | null;
  serviceNameSnapshot?: string | null;
  servicePriceSnapshotCzk?: number | null;
  validFrom?: Date;
  validUntil?: Date;
  formError?: string;
  fieldErrors?: Partial<Record<"code" | "type" | "originalValueCzk" | "serviceId" | "validFrom" | "validUntil", string>>;
};

export const initialVoucherStockActivationState: VoucherStockActivationState = { status: "idle" };

export type CreateVoucherPrintBatchState = {
  status: "idle" | "error";
  formError?: string;
  fieldErrors?: Partial<Record<"templateKey" | "quantity", string>>;
};

export const initialCreateVoucherPrintBatchState: CreateVoucherPrintBatchState = { status: "idle" };
