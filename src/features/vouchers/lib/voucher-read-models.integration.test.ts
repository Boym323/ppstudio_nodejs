import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { EmailLogStatus, EmailLogType, VoucherStatus, VoucherType } from "@/generated/prisma/browser";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

async function loadModules() {
  const [{ prisma }, voucherReadModelsModule, adminVouchersModule] = await Promise.all([
    import("@/lib/prisma"),
    import("./voucher-read-models"),
    import("@/features/admin/lib/admin-vouchers"),
  ]);

  return {
    prisma,
    getVoucherDetail: voucherReadModelsModule.getVoucherDetail,
    listVouchers: voucherReadModelsModule.listVouchers,
    getAdminVoucherDetailData: adminVouchersModule.getAdminVoucherDetailData,
    getAdminVouchersPageData: adminVouchersModule.getAdminVouchersPageData,
    getAdminVoucherCreatePageData: adminVouchersModule.getAdminVoucherCreatePageData,
    getAdminVoucherActivationPageData: (await import("@/features/admin/lib/admin-voucher-stock")).getAdminVoucherActivationPageData,
  };
}

async function createVoucher(suffix: string) {
  const { prisma } = await loadModules();

  return prisma.voucher.create({
    data: {
      code: `PP-TEST-${suffix}`,
      type: VoucherType.VALUE,
      status: VoucherStatus.ACTIVE,
      originalValueCzk: 1500,
      remainingValueCzk: 1500,
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      validUntil: new Date("2027-01-01T00:00:00.000Z"),
    },
  });
}

async function createVoucherEmailLog({
  voucherId,
  recipientEmail,
  status,
  createdAt,
  sentAt,
  errorMessage,
}: {
  voucherId: string;
  recipientEmail: string;
  status: EmailLogStatus;
  createdAt: Date;
  sentAt?: Date | null;
  errorMessage?: string | null;
}) {
  const { prisma } = await loadModules();

  return prisma.emailLog.create({
    data: {
      type: EmailLogType.VOUCHER_SENT,
      status,
      attemptCount: status === EmailLogStatus.PENDING ? 0 : 1,
      nextAttemptAt: createdAt,
      processingStartedAt: null,
      processingToken: null,
      recipientEmail,
      subject: "Dárkový poukaz PP Studio",
      templateKey: "voucher-sent-v1",
      payload: {
        voucherId,
      },
      provider: status === EmailLogStatus.SENT ? "log" : null,
      sentAt: sentAt ?? null,
      errorMessage: errorMessage ?? null,
      createdAt,
    },
  });
}

dbTest("getVoucherDetail returns empty email history when no voucher email logs exist", async () => {
  const { prisma, getVoucherDetail } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const voucher = await createVoucher(suffix);

  try {
    const detail = await getVoucherDetail(voucher.id);

    assert.ok(detail);
    assert.deepEqual(detail.emailHistory, []);
  } finally {
    await prisma.voucher.deleteMany({ where: { id: voucher.id } });
  }
});

dbTest("getVoucherDetail exposes pending, sent and failed voucher email history safely", async () => {
  const { prisma, getVoucherDetail, getAdminVoucherDetailData } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const voucher = await createVoucher(suffix);
  const base = new Date("2026-04-28T10:00:00.000Z");

  try {
    await createVoucherEmailLog({
      voucherId: voucher.id,
      recipientEmail: `pending-${suffix}@example.com`,
      status: EmailLogStatus.PENDING,
      createdAt: new Date(base.getTime() + 1_000),
    });
    await createVoucherEmailLog({
      voucherId: voucher.id,
      recipientEmail: `sent-${suffix}@example.com`,
      status: EmailLogStatus.SENT,
      createdAt: new Date(base.getTime() + 2_000),
      sentAt: new Date(base.getTime() + 2_000),
    });
    await createVoucherEmailLog({
      voucherId: voucher.id,
      recipientEmail: `failed-${suffix}@example.com`,
      status: EmailLogStatus.FAILED,
      createdAt: new Date(base.getTime() + 3_000),
      errorMessage: "SMTP timeout\nstack trace should not be exposed",
    });

    const detail = await getVoucherDetail(voucher.id);
    const adminDetail = await getAdminVoucherDetailData("owner", voucher.id);

    assert.ok(detail);
    assert.ok(adminDetail);
    assert.equal(detail.emailHistory.length, 3);
    assert.equal(adminDetail.emailHistory.length, 3);
    assert.deepEqual(detail.emailHistory.map((entry) => entry.status), [
      EmailLogStatus.FAILED,
      EmailLogStatus.SENT,
      EmailLogStatus.PENDING,
    ]);
    assert.equal(detail.emailHistory[0].recipientEmail, `failed-${suffix}@example.com`);
    assert.equal(detail.emailHistory[1].recipientEmail, `sent-${suffix}@example.com`);
    assert.equal(detail.emailHistory[2].recipientEmail, `pending-${suffix}@example.com`);
    assert.equal(detail.emailHistory[0].errorMessage, "SMTP timeout");
    assert.equal(detail.emailHistory[1].errorMessage, null);
    assert.equal(detail.emailHistory[2].errorMessage, null);
    assert.equal(detail.emailHistory[0].sentAt, null);
    assert.equal(detail.emailHistory[1].sentAt?.toISOString(), new Date(base.getTime() + 2_000).toISOString());
    assert.equal(detail.emailHistory[2].sentAt, null);
  } finally {
    await prisma.emailLog.deleteMany({
      where: {
        templateKey: "voucher-sent-v1",
        recipientEmail: {
          contains: suffix,
        },
      },
    });
    await prisma.voucher.deleteMany({ where: { id: voucher.id } });
  }
});

dbTest("getVoucherDetail omits payload and technical fields from email history", async () => {
  const { prisma, getVoucherDetail } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const voucher = await createVoucher(suffix);

  try {
    await createVoucherEmailLog({
      voucherId: voucher.id,
      recipientEmail: `safe-${suffix}@example.com`,
      status: EmailLogStatus.SENT,
      createdAt: new Date("2026-04-28T11:00:00.000Z"),
      sentAt: new Date("2026-04-28T11:00:00.000Z"),
    });

    const detail = await getVoucherDetail(voucher.id);

    assert.ok(detail);
    assert.equal(detail.emailHistory.length, 1);
    assert.deepEqual(Object.keys(detail.emailHistory[0]).sort(), [
      "createdAt",
      "errorMessage",
      "id",
      "recipientEmail",
      "sentAt",
      "status",
    ]);
    assert.equal("payload" in detail.emailHistory[0], false);
    assert.equal("processingToken" in detail.emailHistory[0], false);
    assert.equal("providerMessageId" in detail.emailHistory[0], false);
  } finally {
    await prisma.emailLog.deleteMany({
      where: {
        templateKey: "voucher-sent-v1",
        recipientEmail: {
          contains: suffix,
        },
      },
    });
    await prisma.voucher.deleteMany({ where: { id: voucher.id } });
  }
});

dbTest("getVoucherDetail limits voucher email history to five newest records", async () => {
  const { prisma, getVoucherDetail } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const voucher = await createVoucher(suffix);
  const base = new Date("2026-04-28T12:00:00.000Z");

  try {
    await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        createVoucherEmailLog({
          voucherId: voucher.id,
          recipientEmail: `limit-${index}-${suffix}@example.com`,
          status: EmailLogStatus.SENT,
          createdAt: new Date(base.getTime() + index * 1_000),
          sentAt: new Date(base.getTime() + index * 1_000),
        }),
      ),
    );

    const detail = await getVoucherDetail(voucher.id);

    assert.ok(detail);
    assert.equal(detail.emailHistory.length, 5);
    assert.equal(detail.emailHistory[0].recipientEmail, `limit-5-${suffix}@example.com`);
    assert.equal(detail.emailHistory[4].recipientEmail, `limit-1-${suffix}@example.com`);
  } finally {
    await prisma.emailLog.deleteMany({
      where: {
        templateKey: "voucher-sent-v1",
        recipientEmail: {
          contains: suffix,
        },
      },
    });
    await prisma.voucher.deleteMany({ where: { id: voucher.id } });
  }
});

dbTest("seznamy, filtry a statistiky nezapočítávají budoucí aktivní vouchery", async () => {
  const { prisma, listVouchers, getAdminVouchersPageData } = await loadModules();
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const now = new Date("2030-01-01T12:00:00.000Z");
  const validUntil = new Date("2030-02-01T12:00:00.000Z");
  const openWhere = {
    status: { in: [VoucherStatus.ACTIVE, VoucherStatus.PARTIALLY_REDEEMED] },
    validFrom: { lte: now },
    OR: [{ validUntil: null }, { validUntil: { gte: now } }],
  };
  const [baselineOpen, baselineValue, baselineService] = await Promise.all([
    prisma.voucher.count({ where: openWhere }),
    prisma.voucher.aggregate({ where: { ...openWhere, type: VoucherType.VALUE }, _sum: { remainingValueCzk: true } }),
    prisma.voucher.count({ where: { ...openWhere, type: VoucherType.SERVICE } }),
  ]);
  const codes = ["VALUE", "SERVICE", "FUTURE-VALUE", "FUTURE-SERVICE", "DRAFT", "EXPIRED"].map(
    (kind) => `PP-STAT-${kind}-${suffix}`,
  );

  try {
    await prisma.voucher.createMany({
      data: [
        {
          code: codes[0],
          type: VoucherType.VALUE,
          status: VoucherStatus.ACTIVE,
          originalValueCzk: 500,
          remainingValueCzk: 500,
          validFrom: now,
          validUntil,
        },
        {
          code: codes[1],
          type: VoucherType.SERVICE,
          status: VoucherStatus.ACTIVE,
          serviceNameSnapshot: "Masáž",
          servicePriceSnapshotCzk: 1200,
          validFrom: new Date(now.getTime() - 1),
          validUntil,
        },
        {
          code: codes[2],
          type: VoucherType.VALUE,
          status: VoucherStatus.ACTIVE,
          originalValueCzk: 1200,
          remainingValueCzk: 1200,
          validFrom: new Date("2030-01-02T00:00:00.000Z"),
          validUntil,
        },
        {
          code: codes[3],
          type: VoucherType.SERVICE,
          status: VoucherStatus.ACTIVE,
          serviceNameSnapshot: "Budoucí masáž",
          servicePriceSnapshotCzk: 900,
          validFrom: new Date("2030-01-02T00:00:00.000Z"),
          validUntil,
        },
        {
          code: codes[4],
          type: VoucherType.VALUE,
          status: VoucherStatus.DRAFT,
          originalValueCzk: 300,
          remainingValueCzk: 300,
          validFrom: new Date(now.getTime() - 1),
          validUntil,
        },
        {
          code: codes[5],
          type: VoucherType.VALUE,
          status: VoucherStatus.ACTIVE,
          originalValueCzk: 700,
          remainingValueCzk: 700,
          validFrom: new Date(now.getTime() - 2),
          validUntil: new Date("2029-12-31T21:59:59.999Z"),
        },
      ],
    });

    const [active, draft, expired, page] = await Promise.all([
      listVouchers({ query: suffix, status: VoucherStatus.ACTIVE, now }),
      listVouchers({ query: suffix, status: VoucherStatus.DRAFT, now }),
      listVouchers({ query: suffix, status: VoucherStatus.EXPIRED, now }),
      getAdminVouchersPageData("owner", { q: suffix }, now),
    ]);

    assert.deepEqual(active.map((voucher) => voucher.code).sort(), [codes[0], codes[1]].sort());
    assert.deepEqual(draft.map((voucher) => voucher.code).sort(), [codes[2], codes[3], codes[4]].sort());
    assert.deepEqual(expired.map((voucher) => voucher.code), [codes[5]]);
    assert.equal(page.vouchers.filter((voucher) => voucher.effectiveStatus === VoucherStatus.ACTIVE).length, 2);
    assert.equal(page.vouchers.filter((voucher) => voucher.effectiveStatus === VoucherStatus.DRAFT).length, 3);
    assert.equal(page.stats.find((stat) => stat.label === "Otevřené vouchery")?.value, String(baselineOpen + 2));
    const expectedRemainingValue = (baselineValue._sum?.remainingValueCzk ?? 0) + 500;
    const expectedServiceCount = baselineService + 1;
    const expectedRemainingParts = [];
    if (expectedRemainingValue > 0 || expectedServiceCount === 0) {
      expectedRemainingParts.push(new Intl.NumberFormat("cs-CZ", {
        maximumFractionDigits: 0,
        style: "currency",
        currency: "CZK",
      }).format(expectedRemainingValue));
    }
    if (expectedServiceCount > 0) {
      expectedRemainingParts.push(`${expectedServiceCount} ${expectedServiceCount === 1 ? "služba" : expectedServiceCount <= 4 ? "služby" : "služeb"}`);
    }
    assert.equal(page.stats.find((stat) => stat.label === "Zbývá k uplatnění")?.value, expectedRemainingParts.join(" + "));
  } finally {
    await prisma.voucher.deleteMany({ where: { code: { in: codes } } });
  }
});

dbTest("voucherové SERVICE selecty nabízejí jen aktivní služby s pevnou cenou", async () => {
  const { prisma, getAdminVoucherCreatePageData, getAdminVoucherActivationPageData } = await loadModules();
  const suffix = randomUUID().slice(0, 8);
  const category = await prisma.serviceCategory.create({ data: { name: `Voucher selector category ${suffix}`, slug: `voucher-selector-category-${suffix}` } });
  const [fixedActive, noPriceActive, fixedInactive] = await Promise.all([
    prisma.service.create({
      data: {
        categoryId: category.id,
        name: "Aktivní služba s cenou",
        slug: `voucher-selector-fixed-${suffix}`,
        durationMinutes: 60,
        priceFromCzk: 1200,
        isActive: true,
      },
    }),
    prisma.service.create({
      data: {
        categoryId: category.id,
        name: "Aktivní služba bez ceny",
        slug: `voucher-selector-no-price-${suffix}`,
        durationMinutes: 60,
        priceFromCzk: null,
        isActive: true,
      },
    }),
    prisma.service.create({
      data: {
        categoryId: category.id,
        name: "Neaktivní služba s cenou",
        slug: `voucher-selector-inactive-${suffix}`,
        durationMinutes: 60,
        priceFromCzk: 900,
        isActive: false,
      },
    }),
  ]);

  try {
    const [createPage, activationPage] = await Promise.all([
      getAdminVoucherCreatePageData("owner"),
      getAdminVoucherActivationPageData("owner"),
    ]);
    const createServiceIds = createPage.services.map((service) => service.id);
    const activationServiceIds = activationPage.services.map((service) => service.id);

    assert.equal(createServiceIds.includes(fixedActive.id), true);
    assert.equal(createServiceIds.includes(noPriceActive.id), false);
    assert.equal(createServiceIds.includes(fixedInactive.id), false);
    assert.equal(activationServiceIds.includes(fixedActive.id), true);
    assert.equal(activationServiceIds.includes(noPriceActive.id), false);
    assert.equal(activationServiceIds.includes(fixedInactive.id), false);
  } finally {
    await prisma.service.deleteMany({ where: { id: { in: [fixedActive.id, noPriceActive.id, fixedInactive.id] } } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
  }
});

dbTest("voucher KPI používají stejný Europe/Prague kalendářní den jako seznam", async () => {
  const { prisma, listVouchers, getAdminVouchersPageData } = await loadModules();
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const now = new Date("2026-09-19T08:00:00.000Z");
  const before = await getAdminVouchersPageData("owner", { q: `KPI-BASELINE-${suffix}` }, now);
  const codes = ["SAME-DAY", "FUTURE", "EXPIRED"].map((kind) => `PP-KPI-TZ-${kind}-${suffix}`);

  try {
    await prisma.voucher.createMany({
      data: [
        {
          code: codes[0],
          type: VoucherType.VALUE,
          status: VoucherStatus.ACTIVE,
          originalValueCzk: 500,
          remainingValueCzk: 500,
          validFrom: new Date("2026-09-19T12:00:00.000Z"),
          validUntil: new Date("2026-09-19T20:00:00.000Z"),
        },
        {
          code: codes[1],
          type: VoucherType.VALUE,
          status: VoucherStatus.ACTIVE,
          originalValueCzk: 600,
          remainingValueCzk: 600,
          validFrom: new Date("2026-09-20T00:00:00.000Z"),
          validUntil: new Date("2026-09-20T20:00:00.000Z"),
        },
        {
          code: codes[2],
          type: VoucherType.VALUE,
          status: VoucherStatus.ACTIVE,
          originalValueCzk: 700,
          remainingValueCzk: 700,
          validFrom: new Date("2026-09-17T12:00:00.000Z"),
          validUntil: new Date("2026-09-18T20:00:00.000Z"),
        },
      ],
    });

    const [active, draft, expired, page] = await Promise.all([
      listVouchers({ query: suffix, status: VoucherStatus.ACTIVE, now }),
      listVouchers({ query: suffix, status: VoucherStatus.DRAFT, now }),
      listVouchers({ query: suffix, status: VoucherStatus.EXPIRED, now }),
      getAdminVouchersPageData("owner", { q: suffix }, now),
    ]);
    const stat = (label: string, source = page) => Number(source.stats.find((item) => item.label === label)?.value ?? 0);

    assert.deepEqual(active.map((voucher) => voucher.code), [codes[0]]);
    assert.deepEqual(draft.map((voucher) => voucher.code), [codes[1]]);
    assert.deepEqual(expired.map((voucher) => voucher.code), [codes[2]]);
    assert.equal(stat("Otevřené vouchery") - stat("Otevřené vouchery", before), 1);
    assert.equal(stat("Brzy expirují") - stat("Brzy expirují", before), 1);
    assert.equal(stat("Uzavřené") - stat("Uzavřené", before), 1);
  } finally {
    await prisma.voucher.deleteMany({ where: { code: { in: codes } } });
  }
});

dbTest("voucher KPI zachovají stejné datumové hranice při jarním a podzimním DST", async () => {
  const { prisma, listVouchers, getAdminVouchersPageData } = await loadModules();
  const cases = [
    { label: "SPRING", now: new Date("2026-03-29T08:00:00.000Z"), validUntil: new Date("2026-03-29T20:00:00.000Z") },
    { label: "AUTUMN", now: new Date("2026-10-25T08:00:00.000Z"), validUntil: new Date("2026-10-25T20:00:00.000Z") },
  ];

  for (const item of cases) {
    const suffix = `${item.label}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const code = `PP-KPI-DST-${suffix}`;
    const before = await getAdminVouchersPageData("owner", { q: `KPI-DST-BASELINE-${suffix}` }, item.now);

    try {
      await prisma.voucher.create({
        data: {
          code,
          type: VoucherType.VALUE,
          status: VoucherStatus.ACTIVE,
          originalValueCzk: 800,
          remainingValueCzk: 800,
          validFrom: new Date(item.now.getTime() + 4 * 60 * 60 * 1000),
          validUntil: item.validUntil,
        },
      });

      const [active, page] = await Promise.all([
        listVouchers({ query: suffix, status: VoucherStatus.ACTIVE, now: item.now }),
        getAdminVouchersPageData("owner", { q: suffix }, item.now),
      ]);
      const stat = (label: string, source = page) => Number(source.stats.find((entry) => entry.label === label)?.value ?? 0);

      assert.deepEqual(active.map((voucher) => voucher.code), [code]);
      assert.equal(stat("Otevřené vouchery") - stat("Otevřené vouchery", before), 1);
      assert.equal(stat("Brzy expirují") - stat("Brzy expirují", before), 1);
    } finally {
      await prisma.voucher.deleteMany({ where: { code } });
    }
  }
});
