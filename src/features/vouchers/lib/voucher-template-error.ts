export class VoucherTemplateError extends Error {
  readonly code: "unknown_template" | "invalid_master_page_size" | "text_overflow" | "invalid_print_pdf";

  constructor(
    readonly templateKey: string | null | undefined,
    options: { code?: "unknown_template" | "invalid_master_page_size" | "text_overflow" | "invalid_print_pdf"; message?: string } = {},
  ) {
    super(options.message ?? `Voucher template "${templateKey ?? ""}" is not available.`);
    this.code = options.code ?? "unknown_template";
    this.name = "VoucherTemplateError";
  }
}
