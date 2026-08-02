"use server";

import { headers } from "next/headers";

import { validateVoucherForBookingInput } from "@/features/vouchers/lib/voucher-validation";
import {
  getRecentVoucherPublicVerificationAttemptCount,
  getVoucherPublicVerificationMetadata,
  isVoucherPublicVerificationRateLimited,
  publicVoucherVerificationSources,
  writeVoucherPublicVerificationAttemptLog,
} from "@/features/vouchers/lib/voucher-public-verification-rate-limit";
import { toPublicBookingVoucherValidationSuccess } from "@/features/booking/lib/public-booking-voucher-presentation";

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
  const source = publicVoucherVerificationSources.publicBooking;
  const ipAttempts = await getRecentVoucherPublicVerificationAttemptCount({
    ...requestMetadata,
    source,
  });

  if (isVoucherPublicVerificationRateLimited(ipAttempts)) {
    await writeVoucherPublicVerificationAttemptLog({
      auditOutcome: "RATE_LIMITED",
      source,
      ...requestMetadata,
      metadata: { ipAttempts, source },
    });

    return { ok: false as const, reason: "RATE_LIMITED" as const };
  }

  try {
    const result = await validateVoucherForBookingInput(input);

    await writeVoucherPublicVerificationAttemptLog({
      auditOutcome: result.ok ? "SUCCESS" : "NOT_FOUND_OR_INVALID",
      source,
      ...requestMetadata,
      metadata: { ipAttempts, source },
    });

    if (!result.ok) {
      return {
        ok: false as const,
        reason: result.reason,
        serviceNameSnapshot: result.serviceNameSnapshot,
      };
    }

    return toPublicBookingVoucherValidationSuccess(result);
  } catch (error) {
    console.error("Public booking voucher validation failed", error);

    await writeVoucherPublicVerificationAttemptLog({
      auditOutcome: "UNKNOWN_ERROR",
      source,
      ...requestMetadata,
      metadata: { ipAttempts, source },
    });

    return { ok: false as const, reason: "UNKNOWN_ERROR" as const };
  }
}
