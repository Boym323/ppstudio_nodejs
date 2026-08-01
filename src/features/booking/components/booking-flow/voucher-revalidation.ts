export type VoucherApplicationState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "applied"; label: string }
  | { status: "incompatible"; message: string }
  | { status: "invalid"; message: string };

type VoucherValidationResult =
  | { ok: true; code: string; displayLabel: string }
  | { ok: false; reason: string; serviceNameSnapshot?: string };

function getVoucherValidationMessage(reason: string) {
  switch (reason) {
    case "NOT_FOUND": return "Voucher nebyl nalezen. Zkontrolujte prosím kód.";
    case "DRAFT": return "Voucher zatím není aktivní.";
    case "REDEEMED": return "Voucher už byl uplatněn.";
    case "EXPIRED": return "Voucher je propadlý.";
    case "NO_REMAINING_VALUE": return "Voucher už nemá žádný dostupný zůstatek.";
    case "RATE_LIMITED": return "Příliš mnoho pokusů o ověření. Počkejte prosím chvíli a zkuste to znovu.";
    default: return "Voucher se nepodařilo ověřit. Zkontrolujte prosím kód.";
  }
}

export function resolveVoucherRevalidation(result: VoucherValidationResult) {
  if (result.ok) {
    return {
      appliedVoucherCode: result.code,
      voucherApplication: { status: "applied", label: result.displayLabel } satisfies VoucherApplicationState,
    };
  }

  if (result.reason === "SERVICE_MISMATCH") {
    const serviceName = result.serviceNameSnapshot ?? "původní službu";

    return {
      appliedVoucherCode: "",
      voucherApplication: {
        status: "incompatible",
        message: `Tento poukaz je určený pro službu „${serviceName}“. Pro nově vybranou službu jej nelze použít.`,
      } satisfies VoucherApplicationState,
    };
  }

  return {
    appliedVoucherCode: "",
    voucherApplication: {
      status: "invalid",
      message: getVoucherValidationMessage(result.reason),
    } satisfies VoucherApplicationState,
  };
}
