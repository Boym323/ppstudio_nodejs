export class VoucherTemplateError extends Error {
  readonly code: "unknown_template" | "invalid_master_page_size";

  constructor(
    readonly templateKey: string | null | undefined,
    options: { code?: "unknown_template" | "invalid_master_page_size"; message?: string } = {},
  ) {
    super(options.message ?? `Voucher template "${templateKey ?? ""}" is not available.`);
    this.code = options.code ?? "unknown_template";
    this.name = "VoucherTemplateError";
  }
}
