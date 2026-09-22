export type VoucherTemplateDomainErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "IMMUTABLE"
  | "INVALID_STATE"
  | "DEFAULT_GUARD"
  | "MASTER_INVALID";

export class VoucherTemplateDomainError extends Error {
  constructor(
    readonly code: VoucherTemplateDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "VoucherTemplateDomainError";
  }
}
