"use server";

import { validateVoucherForBookingInput } from "@/features/vouchers/lib/voucher-validation";

/**
 * Vrací pouze údaje potřebné pro veřejný rezervační formulář. Výsledek slouží
 * výhradně k UX; booking engine voucher při odeslání vždy ověřuje znovu.
 */
export async function validatePublicBookingVoucherAction(input: {
  code: string;
  serviceId: string;
}) {
  const result = await validateVoucherForBookingInput(input);

  if (!result.ok) {
    return {
      ok: false as const,
      reason: result.reason,
      serviceNameSnapshot: result.serviceNameSnapshot,
    };
  }

  return {
    ok: true as const,
    code: result.code,
    type: result.type,
    displayLabel: result.displayLabel,
    remainingValueCzk: result.remainingValueCzk,
    serviceNameSnapshot: result.serviceNameSnapshot,
  };
}
