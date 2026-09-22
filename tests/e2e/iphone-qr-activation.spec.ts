import { randomBytes } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import {
  AdminRole,
  VoucherPrintBatchStatus,
  VoucherStatus,
  VoucherStockItemStatus,
  VoucherType,
} from "@/generated/prisma/client";

import { createAdminFixture, prisma } from "./helpers/fixtures";

async function loginAdmin(page: Page, email: string, password: string) {
  await page.goto("/admin/prihlaseni");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Heslo").fill(password);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/admin" || url.pathname === "/admin/provoz");
}

async function createStockItem(runId: string, ownerEmail: string, status: VoucherStockItemStatus) {
  const owner = await prisma.adminUser.findUniqueOrThrow({ where: { email: ownerEmail }, select: { id: true } });
  const classicTemplate = await prisma.voucherTemplate.findUniqueOrThrow({ where: { key: "classic-v1" }, select: { id: true, key: true } });
  const suffix = `${runId.replace(/[^a-z0-9]/gi, "").slice(-8)}${status.slice(0, 2)}`.toUpperCase();
  const code = `PP-2026-${suffix}`;
  const batch = await prisma.voucherPrintBatch.create({
    data: {
      batchNumber: `2026-E2E-${suffix}`,
      templateKey: "classic-v1",
      templateId: classicTemplate.id,
      quantity: 1,
      status: status === VoucherStockItemStatus.PENDING_PRINT ? VoucherPrintBatchStatus.PENDING_PRINT : VoucherPrintBatchStatus.RECEIVED,
      createdByUserId: owner.id,
      receivedAt: status === VoucherStockItemStatus.PENDING_PRINT ? null : new Date(),
      receivedByUserId: status === VoucherStockItemStatus.PENDING_PRINT ? null : owner.id,
      items: {
        create: {
          sequenceNumber: 1,
          code,
          status,
          voidedAt: status === VoucherStockItemStatus.VOID ? new Date() : null,
          voidedByUserId: status === VoucherStockItemStatus.VOID ? owner.id : null,
          voidReason: status === VoucherStockItemStatus.VOID ? "E2E test" : null,
        },
      },
    },
    include: { items: true },
  });

  if (status === VoucherStockItemStatus.ACTIVATED) {
    const voucher = await prisma.voucher.create({
      data: {
        code,
        type: VoucherType.VALUE,
        templateKey: classicTemplate.key,
        templateId: classicTemplate.id,
        status: VoucherStatus.ACTIVE,
        originalValueCzk: 1500,
        remainingValueCzk: 1500,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
        validUntil: new Date("2027-01-01T00:00:00.000Z"),
        issuedAt: new Date("2026-01-01T00:00:00.000Z"),
        createdByUserId: owner.id,
      },
    });
    await prisma.voucherStockItem.update({
      where: { id: batch.items[0].id },
      data: { voucherId: voucher.id, activatedAt: new Date(), activatedByUserId: owner.id },
    });
  }

  return { batchId: batch.id, code };
}

async function cleanupStockItems(batchIds: string[], codes: string[], adminEmails: string[]) {
  await prisma.voucherStockAuditLog.deleteMany({ where: { batchId: { in: batchIds } } });
  await prisma.voucherStockItem.updateMany({ where: { batchId: { in: batchIds } }, data: { voucherId: null } });
  await prisma.voucher.deleteMany({ where: { code: { in: codes } } });
  await prisma.voucherStockItem.deleteMany({ where: { batchId: { in: batchIds } } });
  await prisma.voucherPrintBatch.deleteMany({ where: { id: { in: batchIds } } });
  await prisma.adminUser.deleteMany({ where: { email: { in: adminEmails } } });
}

test.describe("iPhone QR activation v1", () => {
  test("OWNER a SALON dostanou CTA, anonymní HTML ho nikdy neobsahuje a deep-link aktivaci předvyplní", async ({ page }) => {
    const runId = `iphone-${Date.now()}-${randomBytes(4).toString("hex")}`;
    const owner = await createAdminFixture(runId, AdminRole.OWNER);
    const salon = await createAdminFixture(`${runId}-salon`, AdminRole.SALON);
    const stock = await createStockItem(runId, owner.email, VoucherStockItemStatus.AVAILABLE);

    try {
      await page.goto(`/vouchery/overeni?code=${stock.code}`);
      await expect(page.getByText("Voucher zatím nebyl aktivován.")).toBeVisible();
      await expect(page.getByRole("link", { name: "Aktivovat tento voucher" })).toHaveCount(0);
      expect(await page.content()).not.toContain("Aktivovat tento voucher");

      await loginAdmin(page, owner.email, owner.password);
      await page.goto(`/vouchery/overeni?code=${stock.code}`);
      const ownerCta = page.getByRole("link", { name: "Aktivovat tento voucher" });
      await expect(ownerCta).toHaveAttribute("href", `/admin/vouchery/aktivovat?code=${stock.code}`);

      await page.context().clearCookies();
      await page.goto(`/vouchery/overeni?code=${stock.code}`);
      await expect(page.getByRole("link", { name: "Aktivovat tento voucher" })).toHaveCount(0);
      expect(await page.content()).not.toContain("Aktivovat tento voucher");
      await page.goto(`/admin/provoz/vouchery/aktivovat?code=${stock.code}`);
      await expect(page).toHaveURL(/\/admin\/prihlaseni/);

      await loginAdmin(page, salon.email, salon.password);
      await page.goto(`/vouchery/overeni?code=${stock.code}`);
      const salonCta = page.getByRole("link", { name: "Aktivovat tento voucher" });
      await expect(salonCta).toHaveAttribute("href", `/admin/provoz/vouchery/aktivovat?code=${stock.code}`);
      await salonCta.click();
      await expect(page).toHaveURL(`/admin/provoz/vouchery/aktivovat?code=${stock.code}`);
      await expect(page.getByLabel("Kód voucheru")).toHaveValue(stock.code);
      await expect(page.getByText("K dispozici")).toBeVisible();
      await expect(page.getByRole("button", { name: "Potvrdit prodej a aktivovat" })).toBeVisible();

      page.once("dialog", (dialog) => dialog.accept());
      await page.getByLabel("Hodnota v Kč").fill("1500");
      await page.getByRole("button", { name: "Potvrdit prodej a aktivovat" }).click();
      await expect(page.getByRole("heading", { name: "Voucher aktivován" })).toBeVisible();
      await expect(page.getByText("KÓD VOUCHERU")).toBeVisible();
      await expect(page.getByText("HODNOTA VOUCHERU")).toBeVisible();
      await expect(page.getByText("1 500 Kč").first()).toBeVisible();
      await expect(page.getByText("K ÚHRADĚ")).toBeVisible();
      await expect(page.getByText("Na fyzický voucher doplňte:")).toBeVisible();
      await expect(page.getByText("VĚNOVÁNO NA")).toBeVisible();

      const activated = await prisma.voucherStockItem.findUniqueOrThrow({ where: { code: stock.code }, select: { status: true } });
      expect(activated.status).toBe(VoucherStockItemStatus.ACTIVATED);

      await page.goto(`/vouchery/overeni?code=${stock.code}`);
      await expect(page.getByText("Voucher je platný")).toBeVisible();
      await expect(page.getByRole("link", { name: "Aktivovat tento voucher" })).toHaveCount(0);
    } finally {
      await cleanupStockItems([stock.batchId], [stock.code], [owner.email, salon.email]);
    }
  });

  test("PENDING_PRINT a VOID nepovolí aktivaci a ACTIVATED zůstane běžným veřejným voucherem", async ({ page }) => {
    const runId = `iphone-status-${Date.now()}-${randomBytes(4).toString("hex")}`;
    const owner = await createAdminFixture(runId, AdminRole.OWNER);
    const pending = await createStockItem(`${runId}-pending`, owner.email, VoucherStockItemStatus.PENDING_PRINT);
    const voided = await createStockItem(`${runId}-void`, owner.email, VoucherStockItemStatus.VOID);
    const activated = await createStockItem(`${runId}-activated`, owner.email, VoucherStockItemStatus.ACTIVATED);
    const batchIds = [pending.batchId, voided.batchId, activated.batchId];
    const codes = [pending.code, voided.code, activated.code];

    try {
      await page.goto(`/vouchery/overeni?code=${pending.code}`);
      await expect(page.getByRole("link", { name: "Aktivovat tento voucher" })).toHaveCount(0);
      await expect(page.getByText("Voucher zatím nebyl aktivován.")).toBeVisible();

      await loginAdmin(page, owner.email, owner.password);
      await page.goto(`/vouchery/overeni?code=${pending.code}`);
      await expect(page.getByText("Tento předtištěný voucher ještě není připraven k aktivaci.")).toBeVisible();
      await expect(page.getByRole("link", { name: "Aktivovat tento voucher" })).toHaveCount(0);

      await page.goto(`/vouchery/overeni?code=${voided.code}`);
      await expect(page.getByText("Voucher není platný.")).toBeVisible();
      await expect(page.getByRole("link", { name: "Aktivovat tento voucher" })).toHaveCount(0);

      await page.goto(`/vouchery/overeni?code=${activated.code}`);
      await expect(page.getByText("Voucher je platný")).toBeVisible();
      await expect(page.getByRole("link", { name: "Aktivovat tento voucher" })).toHaveCount(0);

      await page.goto(`/admin/vouchery/aktivovat?code=${voided.code}`);
      await expect(page.getByText("Tento fyzický voucher je znehodnocený a nelze ho aktivovat.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Potvrdit prodej a aktivovat" })).toHaveCount(0);

      await page.goto(`/admin/vouchery/aktivovat?code=${activated.code}`);
      await expect(page.getByText("Tento voucher byl již aktivován.")).toBeVisible();
      await expect(page.getByRole("button", { name: "Potvrdit prodej a aktivovat" })).toHaveCount(0);

      await page.goto("/admin/vouchery/aktivovat?code=not-a-voucher-code");
      await expect(page.getByRole("heading", { name: "Aktivovat voucher" })).toBeVisible();
      await expect(page.getByLabel("Kód voucheru")).toHaveValue("NOT-A-VOUCHER-CODE");
      await expect(page.getByText("Předtištěný voucher")).toHaveCount(0);

      await page.goto("/vouchery/overeni?code=PP-2026-UNKNOWN");
      await expect(page.getByRole("link", { name: "Aktivovat tento voucher" })).toHaveCount(0);
    } finally {
      await cleanupStockItems(batchIds, codes, [owner.email]);
    }
  });
});
