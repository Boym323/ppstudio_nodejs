"use server";

import { headers } from "next/headers";

import { validateVoucherForBookingInput } from "@/features/vouchers/lib/voucher-validation";
import {
  getRecentVoucherPublicVerificationAttemptCount,
  getVoucherPublicVerificationMetadata,
  isVoucherPublicVerificationRateLimited,
  writeVoucherPublicVerificationAttemptLog,
} from "@/features/vouchers/lib/voucher-public-verification-rate-limit";

/**
 * Vrací pouze údaje potřebné pro veřejný rezervační formulář. Výsledek slouží
 * výhradně k UX; booking engine voucher při odeslání vždy ověřuje znovu.
 */
export async function validatePublicBookingVoucherAction(input: {
  code: string;
  serviceId: string;
}) {
  const requestHeaders = await headers();
  const requestMetadata = getVoucherPublicVerificationMetadata(requestHeaders);
  const ipAttempts = await getRecentVoucherPublicVerificationAttemptCount(requestMetadata.ipHash);

  if (isVoucherPublicVerificationRateLimited(ipAttempts)) {
    await writeVoucherPublicVerificationAttemptLog({
      auditOutcome: "RATE_LIMITED",
      ...requestMetadata,
      metadata: { ipAttempts, source: "public-booking-voucher-validation" },
    });

    return { ok: false as const, reason: "RATE_LIMITED" as const };
  }

  try {
    const result = await validateVoucherForBookingInput(input);

    await writeVoucherPublicVerificationAttemptLog({
      auditOutcome: result.ok ? "SUCCESS" : "NOT_FOUND_OR_INVALID",
      ...requestMetadata,
      metadata: { ipAttempts, source: "public-booking-voucher-validation" },
    });

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
  } catch (error) {
    console.error("Public booking voucher validation failed", error);

    await writeVoucherPublicVerificationAttemptLog({
      auditOutcome: "UNKNOWN_ERROR",
      ...requestMetadata,
      metadata: { ipAttempts, source: "public-booking-voucher-validation" },
    });

    return { ok: false as const, reason: "UNKNOWN_ERROR" as const };
  }
}
