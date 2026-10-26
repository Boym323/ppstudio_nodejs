import assert from "node:assert/strict";
import test from "node:test";

import { AdminRole, VoucherType } from "@/generated/prisma/browser";

process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("createAdminVoucherAction validates input and rejects an outdated template before mutation", async (t) => {
  const session = { sub: "owner-1", role: AdminRole.OWNER };
  let createCalls = 0;
  let templateCurrent = false;
  const revalidatedPaths: string[] = [];
  const redirects: string[] = [];

  class MockVoucherManagementError extends Error {
    constructor(readonly code: string) { super(code); }
  }

  t.mock.module("@/lib/auth/session", { exports: { requireRole: async () => session } });
  t.mock.module("next/cache", { exports: { revalidatePath: (path: string) => revalidatedPaths.push(path) } });
  t.mock.module("next/navigation", { exports: { redirect: (path: string) => redirects.push(path) } });
  t.mock.module("@/features/admin/lib/admin-vouchers", {
    exports: {
      getAdminVoucherHref: (...args: string[]) => `/admin/vouchery/${args[1]}`,
      getAdminVouchersHref: () => "/admin/vouchery",
    },
  });
  t.mock.module("@/features/vouchers/lib/voucher-management", {
    exports: {
      createVoucher: async () => { createCalls += 1; return { id: "voucher-1" }; },
      VoucherManagementError: MockVoucherManagementError,
      voucherManagementErrorCodes: {
        serviceNotFound: "SERVICE_NOT_FOUND",
        serviceNotActive: "SERVICE_NOT_ACTIVE",
        servicePriceMissing: "SERVICE_PRICE_MISSING",
        templateUnavailable: "TEMPLATE_UNAVAILABLE",
        transientConflict: "TRANSIENT_CONFLICT",
        operationFailed: "OPERATION_FAILED",
      },
    },
  });
  t.mock.module("@/features/vouchers/lib/voucher-operations", {
    exports: {
      cancelVoucherOperationally: async () => ({ changed: false }),
      updateVoucherOperationalDetails: async () => ({ changed: false }),
      VoucherOperationError: Error,
      voucherOperationErrorCodes: {},
    },
  });
  t.mock.module("@/features/vouchers/lib/voucher-template-repository", {
    exports: {
      getVoucherTemplateByKey: async () => ({ status: "PUBLISHED", key: "classic-v1" }),
      isVoucherTemplateAllowedForType: () => true,
      isVoucherTemplateCurrentForIssuance: () => templateCurrent,
    },
  });
  t.mock.module("@/lib/notifications/pushover", {
    exports: { sendOwnerSystemErrorPushover: async () => undefined },
  });
  t.mock.module("@/lib/prisma", {
    exports: { prisma: { service: { findFirst: async () => ({ id: "service-1" }) } } },
  });

  const { createAdminVoucherAction } = await import("./voucher-actions");
  const initialState = { status: "idle" as const };
  const form = (values: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.set(key, value);
    return data;
  };

  const invalid = await createAdminVoucherAction(initialState, form({ type: VoucherType.VALUE }));
  assert.equal(invalid.status, "error");
  assert.equal(invalid.formError, "Voucher je potřeba ještě doplnit nebo opravit.");
  assert.equal(createCalls, 0);

  const outdated = await createAdminVoucherAction(initialState, form({
    type: VoucherType.VALUE,
    templateKey: "classic-v1",
    originalValueCzk: "1500",
    validFrom: "2026-08-17",
    validUntil: "2026-12-31",
  }));
  assert.deepEqual(outdated, {
    status: "error",
    formError: "Vybraný vzhled voucheru už není dostupný.",
    fieldErrors: { templateKey: "Vyberte vzhled dostupný pro tento typ voucheru." },
  });
  assert.equal(createCalls, 0);

  templateCurrent = true;
  await createAdminVoucherAction(initialState, form({
    type: VoucherType.VALUE,
    templateKey: "classic-v1",
    originalValueCzk: "1500",
    validFrom: "2026-08-17",
    validUntil: "2026-12-31",
  }));
  assert.equal(createCalls, 1);
  assert.deepEqual(revalidatedPaths, ["/admin/vouchery"]);
  assert.deepEqual(redirects, ["/admin/vouchery/voucher-1"]);
});
