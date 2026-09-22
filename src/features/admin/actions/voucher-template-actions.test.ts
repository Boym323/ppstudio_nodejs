import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_URL ??= "https://ppstudio.cz";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("template lifecycle actions vyžadují OWNER a volají domain operace", async (t) => {
  let role = "OWNER";
  const calls: Array<[string, string, string?]> = [];
  const revalidated: string[] = [];
  const redirects: string[] = [];

  t.mock.module("@/lib/auth/session", {
    exports: {
      requireRole: async (roles: string[]) => {
        assert.deepEqual(roles, ["OWNER"]);
        if (role !== "OWNER") throw new Error("forbidden");
        return { sub: "owner-1", role };
      },
    },
  });
  t.mock.module("next/cache", { exports: { revalidatePath: (value: string) => revalidated.push(value) } });
  t.mock.module("next/navigation", { exports: { redirect: (value: string) => redirects.push(value) } });
  t.mock.module("@/features/vouchers/lib/voucher-template-domain", {
    exports: {
      cloneVoucherTemplateVersion: async (id: string, actor: string) => { calls.push(["clone", id, actor]); return { id: "clone-1" }; },
      createVoucherTemplateDraft: async () => ({ id: "draft-1" }),
      deactivateVoucherTemplate: async (id: string, actor: string) => { calls.push(["deactivate", id, actor]); },
      deleteVoucherTemplateDraft: async (id: string, actor: string) => { calls.push(["delete", id, actor]); },
      publishVoucherTemplate: async (id: string, actor: string) => { calls.push(["publish", id, actor]); },
      replaceVoucherTemplateMaster: async () => undefined,
      updateVoucherTemplateDraft: async () => undefined,
    },
  });
  t.mock.module("@/features/vouchers/lib/voucher-template-repository", {
    exports: {
      requireVoucherTemplateById: async () => ({ id: "draft-1", status: "DRAFT", key: "classic-v1", label: "Klasický" }),
      resolveVoucherTemplate: async () => ({ id: "draft-1" }),
    },
  });
  t.mock.module("@/features/vouchers/lib/voucher-pdf", { exports: { generateResolvedVoucherDigitalPdf: async () => Buffer.from("%PDF-") } });
  t.mock.module("@/lib/email/provider", { exports: { sendEmail: async () => undefined } });

  const actions = await import("./voucher-template-actions");

  await actions.publishVoucherTemplateAction("template-1");
  await actions.deactivateVoucherTemplateAction("template-1");
  await actions.cloneVoucherTemplateVersionAction("template-1");
  await actions.deleteVoucherTemplateDraftAction("template-1");

  assert.deepEqual(calls, [
    ["publish", "template-1", "owner-1"],
    ["deactivate", "template-1", "owner-1"],
    ["clone", "template-1", "owner-1"],
    ["delete", "template-1", "owner-1"],
  ]);
  assert.deepEqual(redirects, ["/admin/vouchery/sablony/clone-1", "/admin/vouchery/sablony"]);
  assert.deepEqual(revalidated, [
    "/admin/vouchery/sablony/template-1",
    "/admin/vouchery/sablony",
    "/admin/vouchery/sablony/template-1",
    "/admin/vouchery/sablony",
    "/admin/vouchery/sablony",
    "/admin/vouchery/sablony",
  ]);

  role = "SALON";
  await assert.rejects(() => actions.publishVoucherTemplateAction("template-1"), /forbidden/);
  assert.equal(calls.length, 4);
});
