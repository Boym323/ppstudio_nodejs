import { AdminRole, VoucherStockItemStatus } from "@/generated/prisma/browser";

import { getAdminVoucherActivationHref } from "@/features/admin/lib/admin-voucher-stock-paths";
import { findVoucherStockItemByCode } from "@/features/vouchers/lib/voucher-stock";
import { normalizeVoucherCode } from "@/features/vouchers/lib/voucher-code";
import { getSession } from "@/lib/auth/session";

export type PublicVoucherAdminActivation =
  | {
      kind: "available";
      href: string;
    }
  | {
      kind: "pending_print";
    };

export async function getPublicVoucherAdminActivation(codeInput: string): Promise<PublicVoucherAdminActivation | null> {
  const session = await getSession();

  if (!session || (session.role !== AdminRole.OWNER && session.role !== AdminRole.SALON)) {
    return null;
  }

  const code = normalizeVoucherCode(codeInput);
  if (!code) {
    return null;
  }

  const stockItem = await findVoucherStockItemByCode(code);
  if (!stockItem) {
    return null;
  }

  if (stockItem.status === VoucherStockItemStatus.AVAILABLE) {
    return {
      kind: "available",
      href: getAdminVoucherActivationHref(session.role === AdminRole.OWNER ? "owner" : "salon", stockItem.code),
    };
  }

  if (stockItem.status === VoucherStockItemStatus.PENDING_PRINT) {
    return { kind: "pending_print" };
  }

  return null;
}
