import assert from "node:assert/strict";
import test from "node:test";
import { VoucherTemplateError } from "@/features/vouchers/lib/voucher-template-error";

process.env.NEXT_PUBLIC_APP_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";

test("test PDF používá layout z requestu a vrací tiskové PDF pouze OWNERovi", async (t) => {
  let role = "OWNER";
  const layout = {
    printPage: { widthMm: 216, heightMm: 105 },
    trim: { xMm: 3, yMm: 3, widthMm: 210, heightMm: 99 },
    valueArea: { xMm: 18, yMm: 39, widthMm: 130, heightMm: 10, baselineMm: 42, maxLines: 1, typography: { fontFamilyKey: "noto-sans", preferredFontSizePt: 16.5, minFontSizePt: 16.5, lineHeightMm: 0, fontWeight: "bold", alignment: "center", color: { c: 0, m: 0, y: 0, k: 1 } } },
    serviceArea: { xMm: 18, yMm: 39, widthMm: 130, heightMm: 11, baselineMm: 41.2, maxLines: 2, typography: { fontFamilyKey: "noto-sans", preferredFontSizePt: 14.5, minFontSizePt: 8.5, lineHeightMm: 0, fontWeight: "bold", alignment: "center", color: { c: 0, m: 0, y: 0, k: 1 } } },
    validityArea: { xMm: 18, yMm: 16, widthMm: 52.5, heightMm: 8, baselineMm: 18.35, maxLines: 1, typography: { fontFamilyKey: "noto-sans", preferredFontSizePt: 7.5, minFontSizePt: 5.8, lineHeightMm: 0, fontWeight: "regular", alignment: "center", color: { c: 0, m: 0, y: 0, k: 1 } } },
    codeArea: { xMm: 81, yMm: 16, widthMm: 67, heightMm: 8, baselineMm: 18.35, maxLines: 1, typography: { fontFamilyKey: "noto-sans", preferredFontSizePt: 7.4, minFontSizePt: 5.8, lineHeightMm: 0, fontWeight: "bold", alignment: "center", color: { c: 0, m: 0, y: 0, k: 1 } } },
    qrArea: { xMm: 173.7, yMm: 20, widthMm: 28, heightMm: 28 },
  };
  let receivedLayout: unknown;
  let renderError: Error | null = null;
  let receivedOptions: unknown;
  let receivedVoucher: { type: string; serviceNameSnapshot: string | null } | undefined;

  t.mock.module("@/lib/auth/session", { exports: { getSession: async () => ({ role }) } });
  t.mock.module("@/features/vouchers/lib/voucher-template-repository", {
    exports: {
      requireVoucherTemplateById: async () => ({ id: "template-1", key: "classic-v1", status: "DRAFT", allowedTypes: ["VALUE"], label: "Classic", layout, masterStoragePath: "master.pdf", masterSha256: "hash" }),
      resolveVoucherTemplate: async (template: { layout: unknown }) => ({ id: "template-1", key: "classic-v1", status: "DRAFT", allowedTypes: ["VALUE"], label: "Classic", layout: template.layout, masterSha256: "hash", masterBytes: Buffer.from("%PDF-") }),
    },
  });
  t.mock.module("@/features/vouchers/lib/voucher-pdf", {
    exports: {
      buildVoucherPrintPdfFilename: (code: string) => `voucher-${code}.pdf`,
      generateResolvedVoucherPrintPdf: async (voucher: { type: string; serviceNameSnapshot: string | null }, template: { layout: unknown }, options: unknown) => { receivedOptions = options; if (renderError) throw renderError; receivedVoucher = voucher; receivedLayout = template.layout; return Buffer.from("%PDF-test"); },
    },
  });
  t.mock.module("@/features/vouchers/lib/voucher-template-preview", {
    exports: { renderVoucherTemplatePreview: async () => Buffer.from([137, 80, 78, 71]) },
  });

  const { POST } = await import("./route");
  const changedLayout = { ...layout, qrArea: { ...layout.qrArea, xMm: 150 } };
  const response = await POST(new Request("https://example.com", { method: "POST", body: JSON.stringify({ layout: changedLayout }), headers: { "content-type": "application/json" } }), { params: Promise.resolve({ templateId: "template-1" }) });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="voucher-TEST-2026-ABCDEF.pdf"');
  assert.deepEqual(receivedLayout, changedLayout);
  assert.deepEqual(receivedOptions, { failOnTextOverflow: true });
  const preview = await POST(new Request("https://example.com?format=preview", { method: "POST", body: JSON.stringify({ layout: changedLayout }), headers: { "content-type": "application/json" } }), { params: Promise.resolve({ templateId: "template-1" }) });
  assert.equal(preview.status, 200);
  assert.equal(preview.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await preview.arrayBuffer()), Buffer.from([137, 80, 78, 71]));
  for (const format of ["", "&format=preview"]) {
    const service = await POST(new Request(`https://example.com?previewType=SERVICE${format}`, { method: "POST", body: JSON.stringify({ layout: changedLayout }), headers: { "content-type": "application/json" } }), { params: Promise.resolve({ templateId: "template-1" }) });
    assert.equal(service.status, 200);
    assert.equal(service.headers.get("content-type"), format ? "image/png" : "application/pdf");
    assert.equal(receivedVoucher?.type, "SERVICE");
    assert.ok(receivedVoucher?.serviceNameSnapshot);
  }
  const logged: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logged.push(args); });
  for (const format of ["", "?format=preview"]) {
    renderError = new VoucherTemplateError("internal-template-key", { code: "text_overflow", message: "Dynamický text se nevejde do oblasti „Hodnota“ ani při minimální velikosti písma." });
    const overflow = await POST(new Request(`https://example.com${format}`, { method: "POST", body: JSON.stringify({ layout: changedLayout }) }), { params: Promise.resolve({ templateId: "template-1" }) });
    assert.equal(overflow.status, 422);
    assert.deepEqual(await overflow.json(), { code: "text_overflow", message: renderError.message });
  }
  for (const code of ["unknown_template", "invalid_master_page_size", "invalid_print_pdf"] as const) {
    renderError = new VoucherTemplateError("internal-template-key", { code, message: "Internal stack /private/master.pdf" });
    const known = await POST(new Request("https://example.com", { method: "POST", body: JSON.stringify({ layout: changedLayout }) }), { params: Promise.resolve({ templateId: "template-1" }) });
    assert.equal(known.status, 422);
    const error = await known.json();
    assert.equal(error.code, code);
    assert.doesNotMatch(error.message, /Internal|private|template-key/);
    assert.deepEqual(Object.keys(error).sort(), ["code", "message"]);
  }
  renderError = new Error("Internal stack /private/master.pdf");
  const unexpected = await POST(new Request("https://example.com?format=preview", { method: "POST", body: JSON.stringify({ layout: changedLayout }) }), { params: Promise.resolve({ templateId: "template-1" }) });
  assert.equal(unexpected.status, 422);
  assert.equal(await unexpected.text(), "Zkušební PDF se nepodařilo vygenerovat. Zkontrolujte layout a fitting textu.");
  assert.ok(logged.some((args) => (args[1] as { error?: unknown }).error === renderError));
  role = "SALON";
  const forbidden = await POST(new Request("https://example.com", { method: "POST", body: "{}" }), { params: Promise.resolve({ templateId: "template-1" }) });
  assert.equal(forbidden.status, 403);
});
