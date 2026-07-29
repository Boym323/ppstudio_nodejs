import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";
import { AdminRole, BookingStatus, VoucherStatus, VoucherType } from "@prisma/client";

import {
  cleanupE2eData,
  createAdminFixture,
  createManagedBookingFixture,
  prisma,
} from "./helpers/fixtures";

test.describe("dokončení návštěvy s úhradou", () => {
  let runId = "";

  test.afterEach(async () => {
    if (runId) {
      await cleanupE2eData(runId);
    }
  });

  test("kombinovaná úhrada dokončí návštěvu, zapíše obě části a skryje další přímou platbu", async ({ page }) => {
    test.setTimeout(90_000);
    const fixture = await createManagedBookingFixture(BookingStatus.CONFIRMED);
    runId = fixture.runId;
    const admin = await createAdminFixture(runId, AdminRole.OWNER);
    const voucherCode = `PP-TEST-${randomBytes(4).toString("hex").toUpperCase()}`;

    await prisma.booking.update({
      where: { id: fixture.bookingId },
      data: {
        scheduledStartsAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        scheduledEndsAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });
    const voucher = await prisma.voucher.create({
      data: {
        code: voucherCode,
        type: VoucherType.VALUE,
        status: VoucherStatus.ACTIVE,
        originalValueCzk: 400,
        remainingValueCzk: 400,
        validFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
        internalNote: runId,
      },
    });

    await page.goto("/admin/prihlaseni");
    await page.getByLabel("E-mail").fill(admin.email);
    await page.getByLabel("Heslo").fill(admin.password);
    await page.getByRole("button", { name: "Přihlásit se" }).click();
    await expect(page).toHaveURL(/\/admin/);

    await page.goto(`/admin/rezervace/${fixture.bookingId}`);
    await expect(page.getByRole("button", { name: /Dokončit návštěvu/ })).toBeVisible();
    const completionPanel = page.locator('[aria-label="Způsob dokončení návštěvy"]').locator("..");
    await completionPanel.getByRole("button", { name: "Kombinovaně" }).click();
    await completionPanel.locator('input[name="directAmountCzk"]').fill("500");
    await completionPanel.locator('input[name="voucherCode"]').fill(voucherCode);
    await completionPanel.locator('input[name="voucherAmountCzk"]').fill("400");
    await completionPanel.getByRole("button", { name: "Zapsat úhrady a dokončit" }).click();

    await expect.poll(async () => {
      const booking = await prisma.booking.findUniqueOrThrow({
        where: { id: fixture.bookingId },
        select: { status: true },
      });
      return booking.status;
    }).toBe(BookingStatus.COMPLETED);

    const [payment, redemption, updatedVoucher, history] = await Promise.all([
      prisma.bookingPayment.findFirstOrThrow({
        where: { bookingId: fixture.bookingId },
        select: { amountCzk: true, method: true, status: true, note: true },
      }),
      prisma.voucherRedemption.findFirstOrThrow({
        where: { bookingId: fixture.bookingId, voucherId: voucher.id },
        select: { amountCzk: true },
      }),
      prisma.voucher.findUniqueOrThrow({ where: { id: voucher.id }, select: { remainingValueCzk: true, status: true } }),
      prisma.bookingStatusHistory.findMany({
        where: { bookingId: fixture.bookingId },
        select: { reason: true },
      }),
    ]);

    expect(payment).toMatchObject({ amountCzk: 500, method: "CASH", status: "ACTIVE", note: null });
    expect(redemption.amountCzk).toBe(400);
    expect(updatedVoucher).toMatchObject({ remainingValueCzk: 0, status: VoucherStatus.REDEEMED });
    expect(history.map((item) => item.reason)).toEqual(expect.arrayContaining([
      "Voucher uplatněn při dokončení návštěvy",
      "Platba zapsána při dokončení návštěvy",
    ]));

    await expect(page.locator("#booking-voucher").getByRole("button", { name: /Zapsat platbu/ })).toHaveCount(0);

    const pricePanel = page.locator("details", { hasText: "Upravit cenu" }).last();
    await pricePanel.locator("summary").click();
    const priceInput = pricePanel.locator('input[name="finalPriceCzk"]');
    await priceInput.fill("1000");
    await expect(pricePanel).toContainText("Po změně bude zbývat doplatit 100 Kč.");
    await priceInput.fill("800");
    await expect(pricePanel).toContainText("Po změně vznikne přeplatek 100 Kč.");
  });
});
