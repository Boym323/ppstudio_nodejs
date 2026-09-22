import assert from "node:assert/strict";
import test from "node:test";

import { AdminRole, VoucherPrintBatchStatus } from "@/generated/prisma/browser";
import { VoucherTemplateError } from "@/features/vouchers/lib/voucher-template-error";
import type { getVoucherDetail } from "@/features/vouchers/lib/voucher-read-models";

process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

type VoucherDetail = NonNullable<Awaited<ReturnType<typeof getVoucherDetail>>>;

const ownerSession = {
  sub: "owner-1",
  email: "owner@example.com",
  name: "Owner",
  role: AdminRole.OWNER,
  iat: 1,
  exp: 999999,
};

const voucher = {
  id: "voucher-1",
  code: "PP-2027-ABC234",
  templateKey: "classic-v1",
} as VoucherDetail;

function createMissingAssetError() {
  return Object.assign(new Error("ENOENT: no such file or directory, open /var/www/ppstudio/public/secret.pdf"), {
    code: "ENOENT",
  });
}

function createFailures() {
  return [
    {
      name: "unknown template",
      error: new VoucherTemplateError("classic-v2"),
      status: 409,
    },
    {
      name: "invalid master geometry",
      error: new VoucherTemplateError("classic-v1", { code: "invalid_master_page_size" }),
      status: 409,
    },
    {
      name: "missing master",
      error: createMissingAssetError(),
      status: 503,
    },
    {
      name: "unexpected render error",
      error: new Error("render failed at /var/www/ppstudio/private/voucher.pdf"),
      status: 500,
    },
  ] as const;
}

type RouteCase = {
  name: string;
  create: (error: unknown) => Promise<Response>;
  context: { voucherId?: string; batchId?: string };
};

async function captureRoute(route: () => Promise<Response>) {
  const calls: unknown[][] = [];
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    calls.push(args);
  };

  try {
    return { response: await route(), calls };
  } finally {
    console.error = originalConsoleError;
  }
}

async function createRouteCases(): Promise<RouteCase[]> {
  const [digitalModule, printModule, stockModule] = await Promise.all([
    import("./admin-voucher-pdf-route"),
    import("./admin-voucher-print-pdf-route"),
    import("./admin-voucher-stock-pdf-route"),
  ]);

  return [
    {
      name: "DIGITAL voucher PDF",
      context: { voucherId: voucher.id },
      create: async (error) => {
        const route = digitalModule.createAdminVoucherPdfRoute({
          getSession: async () => ownerSession,
          getVoucher: async () => voucher,
          generatePdf: async () => { throw error; },
        });
        return route(new Request("https://example.com"), { params: Promise.resolve({ voucherId: voucher.id }) });
      },
    },
    {
      name: "PRINT voucher PDF",
      context: { voucherId: voucher.id },
      create: async (error) => {
        const route = printModule.createAdminVoucherPrintPdfRoute({
          getSession: async () => ownerSession,
          getVoucher: async () => voucher,
          generatePdf: async () => { throw error; },
        });
        return route(new Request("https://example.com"), { params: Promise.resolve({ voucherId: voucher.id }) });
      },
    },
    {
      name: "stock batch PDF",
      context: { batchId: "batch-1" },
      create: async (error) => {
        const route = stockModule.createAdminVoucherStockPdfRoute({
          getSession: async () => ownerSession,
          findBatch: async () => ({
            batchNumber: "2027-001",
            templateKey: "classic-v1",
            status: VoucherPrintBatchStatus.PENDING_PRINT,
            items: [{ code: "PP-2027-ABC234" }],
          }),
          generatePdf: async () => { throw error; },
        });
        return route(new Request("https://example.com"), { params: Promise.resolve({ batchId: "batch-1" }) });
      },
    },
  ];
}

for (const failure of createFailures()) {
  test(`voucher PDF routes handle ${failure.name} safely`, async () => {
    const routes = await createRouteCases();

    for (const routeCase of routes) {
      const { response, calls } = await captureRoute(() => routeCase.create(failure.error));
      const body = await response.text();

      assert.equal(response.status, failure.status, routeCase.name);
      assert.doesNotMatch(body, /ENOENT|\/var\/www\/|stack|Error:|at /i, routeCase.name);
      assert.equal(calls.length, 1, routeCase.name);
      assert.match(String(calls[0]?.[0]), /Voucher PDF/);
      const loggedContext = calls[0]?.[1] as { voucherId?: string; batchId?: string };
      for (const [key, value] of Object.entries(routeCase.context)) {
        assert.equal(loggedContext[key as "voucherId" | "batchId"], value, `${routeCase.name} ${key}`);
      }
    }
  });
}
