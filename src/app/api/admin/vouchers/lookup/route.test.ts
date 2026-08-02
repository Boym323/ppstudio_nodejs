import assert from "node:assert/strict";
import test from "node:test";
import { AdminRole, VoucherStatus, VoucherType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

function createLookupRequest(voucherCode: string) {
  return new Request("https://example.com/api/admin/vouchers/lookup", {
    method: "POST",
    body: JSON.stringify({ voucherCode }),
  });
}

function createAdminSession() {
  return {
    sub: "admin-1",
    role: AdminRole.OWNER,
    email: "owner@example.com",
    name: "Owner",
    iat: 1,
    exp: 999999,
  };
}

test("voucher lookup přijímá kód jen v POST těle a neukládá odpověď do cache", async () => {
  const { createAdminVoucherLookupRouteApi } = await import("./admin-voucher-lookup-route-api");
  let receivedCode = "";
  const api = createAdminVoucherLookupRouteApi({
    getSession: async () => createAdminSession(),
    isSameOriginAdminRequest: () => true,
    findVoucher: (async ({ where }: { where: { code?: string } }) => {
      receivedCode = where.code ?? "";
      return {
        code: "ABCD-1234",
        type: VoucherType.VALUE,
        status: VoucherStatus.ACTIVE,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validUntil: null,
        remainingValueCzk: 1500,
        serviceNameSnapshot: null,
        servicePriceSnapshotCzk: null,
      };
    }) as unknown as typeof prisma.voucher.findUnique,
  });

  const response = await api.POST(createLookupRequest("abcd-1234"));
  const payload = (await response.json()) as { status: string; voucher: { code: string } };

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(receivedCode, "ABCD-1234");
  assert.equal(payload.status, "success");
  assert.equal(payload.voucher.code, "ABCD-1234");
});

test("voucher lookup vrací budoucí aktivní voucher jako koncept", async () => {
  const { createAdminVoucherLookupRouteApi } = await import("./admin-voucher-lookup-route-api");
  const api = createAdminVoucherLookupRouteApi({
    getSession: async () => createAdminSession(),
    isSameOriginAdminRequest: () => true,
    now: () => new Date("2026-08-02T12:00:00.000Z"),
    findVoucher: (async () => ({
      code: "BUDOUCI-1234",
      type: VoucherType.VALUE,
      status: VoucherStatus.ACTIVE,
      validFrom: new Date("2026-08-02T12:00:00.001Z"),
      validUntil: null,
      remainingValueCzk: 1500,
      serviceNameSnapshot: null,
      servicePriceSnapshotCzk: null,
    })) as unknown as typeof prisma.voucher.findUnique,
  });

  const response = await api.POST(createLookupRequest("budouci-1234"));
  const payload = (await response.json()) as { voucher: { status: string; statusLabel: string } };

  assert.equal(response.status, 200);
  assert.equal(payload.voucher.status, VoucherStatus.DRAFT);
  assert.equal(payload.voucher.statusLabel, "Rozpracovaný");
});

test("voucher lookup odmítne request bez same-origin kontroly bez dotazu do databáze", async () => {
  const { createAdminVoucherLookupRouteApi } = await import("./admin-voucher-lookup-route-api");
  const api = createAdminVoucherLookupRouteApi({
    getSession: async () => createAdminSession(),
    isSameOriginAdminRequest: () => false,
    findVoucher: (async () => {
      throw new Error("findVoucher should not run for an unsafe origin");
    }) as unknown as typeof prisma.voucher.findUnique,
  });

  const response = await api.POST(createLookupRequest("ABCD-1234"));

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("voucher lookup route nevystavuje GET handler", async () => {
  const route = await import("./route");

  assert.equal("GET" in route, false);
});
