import assert from "node:assert/strict";
import test from "node:test";
import { validVoucherTemplatePreviewPng } from "@/features/vouchers/lib/voucher-template-test-fixtures";

process.env.NEXT_PUBLIC_APP_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";

test("preview endpoint vrací privátní PNG pouze OWNERovi", async (t) => {
  const png = validVoucherTemplatePreviewPng;
  let role = "OWNER";
  t.mock.module("@/lib/auth/session", { exports: { getSession: async () => ({ role }) } });
  t.mock.module("@/features/vouchers/lib/voucher-template-repository", {
    exports: { getVoucherTemplateById: async () => ({ previewStoragePath: "voucher-templates/template-1/preview-test.png" }) },
  });
  t.mock.module("@/features/vouchers/lib/voucher-template-storage", {
    exports: { readVoucherTemplatePreview: async () => png },
  });

  const { GET } = await import("./route");
  const response = await GET(new Request("https://example.com/api/admin/voucher-templates/template-1/preview?v=hash"), { params: Promise.resolve({ templateId: "template-1" }) });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
  role = "SALON";
  const forbidden = await GET(new Request("https://example.com"), { params: Promise.resolve({ templateId: "template-1" }) });
  assert.equal(forbidden.status, 403);
});
