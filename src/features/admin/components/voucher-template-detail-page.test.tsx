import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Children, isValidElement, type ReactNode } from "react";

import { defaultVoucherTemplateLayout } from "@/features/vouchers/lib/voucher-template-defaults";
import { CURRENT_VOUCHER_TEMPLATE_VALIDATION_POLICY } from "@/features/vouchers/lib/voucher-template-validation-policy";

test("detail odlišuje chybějící grafiku, platný draft, publikovanou a historickou šablonu", async (t) => {
  const template = {
    id: "template-1", key: "test-v1", label: "Test", status: "DRAFT",
    masterStoragePath: null as string | null, masterSha256: "hash", previewStoragePath: "preview",
    validationPolicy: null as string | null, updatedAt: new Date(), layout: defaultVoucherTemplateLayout,
  };
  let errors: string[] = [];
  let loadFails = false;
  let inspections = 0;
  t.mock.module("@/lib/auth/session", { exports: { requireRole: async (roles: string[]) => assert.deepEqual(roles, ["OWNER"]) } });
  t.mock.module("@/features/vouchers/lib/voucher-template-repository", { exports: {
    requireVoucherTemplateById: async () => template,
    loadVoucherTemplateMaster: async () => { if (loadFails) throw new Error("missing"); return Buffer.from("master"); },
  } });
  t.mock.module("@/features/vouchers/lib/voucher-template-preflight", { exports: {
    preflightVoucherTemplateMaster: async () => {
      inspections += 1;
      return { errors, pdfXClaim: "PDF/X-4", pdfXVerification: errors.length ? "DECLARED" : "STRUCTURALLY_VALIDATED", geometryValid: true, iccProfileValid: true, outputIntentValid: true, mediaBox: null, trimBox: null };
    },
  } });
  t.mock.module("@/features/admin/actions/voucher-template-actions", { exports: {
    publishVoucherTemplateAction: async () => {}, sendTestVoucherTemplateEmailAction: async () => {}, uploadVoucherTemplateMasterAction: async () => {},
  } });
  t.mock.module("@/features/admin/components/admin-page-shell", { exports: { AdminPageShell: ({ children }: { children: ReactNode }) => <main>{children}</main> } });
  const Editor = () => null;
  t.mock.module("@/features/admin/components/voucher-template-layout-editor", { exports: { VoucherTemplateLayoutEditor: Editor } });
  for (const [file, name] of [
    ["admin-voucher-stock-pages", "AdminVoucherTabs"],
    ["voucher-template-overflow-menu", "VoucherTemplateOverflowMenu"],
    ["voucher-template-published-preview", "VoucherTemplatePublishedPreview"],
  ]) t.mock.module(`@/features/admin/components/${file}`, { exports: { [name]: () => null } });

  const { default: Page } = await import("@/app/(admin)/admin/vouchery/sablony/[templateId]/page");
  const page = () => Page({ params: Promise.resolve({ templateId: template.id }), searchParams: Promise.resolve({}) });
  const render = async () => renderToStaticMarkup(await page());
  function editorKey(node: ReactNode): string | null {
    for (const child of Children.toArray(node)) {
      if (!isValidElement<{ children?: ReactNode }>(child)) continue;
      if (child.type === Editor) return child.key;
      const key = editorKey(child.props.children);
      if (key !== null) return key;
    }
    return null;
  }

  let html = await render();
  assert.match(html, /Grafika zatím není nahraná/);
  assert.match(html, /Nahrát grafiku voucheru/);
  assert.match(html, /accept="application\/pdf,\.pdf"/);
  assert.match(html, /<button disabled=""[^>]*>Publikovat/);
  assert.equal(inspections, 0);

  template.masterStoragePath = "master.pdf";
  html = await render();
  assert.match(html, /Grafika prošla kontrolou/);
  assert.doesNotMatch(html, /Připraveno pro tisk/);
  assert.match(html, /Technické detaily/);
  assert.doesNotMatch(html, /<button disabled=""[^>]*>Publikovat/);

  const initialEditorKey = editorKey(await page());
  assert.notEqual(initialEditorKey, null);
  template.updatedAt = new Date(template.updatedAt.getTime() + 1000);
  assert.equal(editorKey(await page()), initialEditorKey, "uložení nesmí resetovat editor");
  template.previewStoragePath = "new-upload-preview";
  assert.notEqual(editorKey(await page()), initialEditorKey, "výměna grafiky musí načíst editor s aktuální revizí i při shodném PDF");

  template.status = "PUBLISHED";
  template.validationPolicy = CURRENT_VOUCHER_TEMPLATE_VALIDATION_POLICY;
  html = await render();
  assert.match(html, /Připraveno pro tisk/);
  assert.doesNotMatch(html, /Nahrát grafiku voucheru|>Publikovat</);

  template.validationPolicy = null;
  html = await render();
  assert.doesNotMatch(html, /Připraveno pro tisk/);

  errors = ["PDF nemá dokumentový OutputIntent."];
  html = await render();
  assert.match(html, /Grafika vyžaduje kontrolu/);
  assert.doesNotMatch(html, /Grafika prošla kontrolou|Připraveno pro tisk/);

  loadFails = true;
  html = await render();
  assert.match(html, /Grafiku se nepodařilo načíst/);
  assert.doesNotMatch(html, /Grafika prošla kontrolou|Připraveno pro tisk/);
});
