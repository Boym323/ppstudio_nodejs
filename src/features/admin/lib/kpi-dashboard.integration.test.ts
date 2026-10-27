import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { BookingPaymentMethod, BookingPaymentStatus, BookingStatus, VoucherType } from "@/generated/prisma/browser";

import { getKpiDateRanges } from "./kpi-date-range";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("KPI finanční agregace ignoruje stornované platby a rozliší hodnotový i službový voucher", async () => {
  const [{ prisma }, { getKpiPeriodAggregates }] = await Promise.all([
    import("@/lib/prisma"),
    import("./kpi-dashboard"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const scheduledStartsAt = new Date("2099-05-10T10:00:00.000Z");
  const cancelledStartsAt = new Date("2099-05-10T12:00:00.000Z");
  const bookingIds: string[] = [];
  const paymentBookingIds: string[] = [];
  const redemptionBookingIds: string[] = [];
  const voucherIds: string[] = [];
  let categoryId = "";
  let serviceId = "";
  let clientId = "";
  const slotIds: string[] = [];

  try {
    const category = await prisma.serviceCategory.create({
      data: { name: `KPI kategorie ${suffix}`, slug: `kpi-kategorie-${suffix}` },
      select: { id: true },
    });
    categoryId = category.id;

    const service = await prisma.service.create({
      data: {
        categoryId,
        name: `KPI služba ${suffix}`,
        slug: `kpi-sluzba-${suffix}`,
        durationMinutes: 60,
        priceFromCzk: 1400,
      },
      select: { id: true },
    });
    serviceId = service.id;

    const client = await prisma.client.create({
      data: { fullName: `KPI klientka ${suffix}`, email: `kpi-${suffix}@example.test` },
      select: { id: true },
    });
    clientId = client.id;

    for (const startsAt of [scheduledStartsAt, cancelledStartsAt]) {
      const slot = await prisma.availabilitySlot.create({
        data: {
          startsAt,
          endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
          status: "ARCHIVED",
          publishedAt: new Date(startsAt.getTime() - 86_400_000),
        },
        select: { id: true },
      });
      slotIds.push(slot.id);
    }

    const booking = await prisma.booking.create({
      data: {
        clientId,
        slotId: slotIds[0]!,
        serviceId,
        status: BookingStatus.COMPLETED,
        clientNameSnapshot: `KPI klientka ${suffix}`,
        clientEmailSnapshot: `kpi-${suffix}@example.test`,
        serviceNameSnapshot: `KPI služba ${suffix}`,
        serviceDurationMinutes: 60,
        servicePriceFromCzk: 1400,
        finalPriceCzk: 2000,
        scheduledStartsAt,
        scheduledEndsAt: new Date(scheduledStartsAt.getTime() + 60 * 60 * 1000),
      },
      select: { id: true },
    });
    bookingIds.push(booking.id);
    paymentBookingIds.push(booking.id);
    redemptionBookingIds.push(booking.id);

    const cancelledBooking = await prisma.booking.create({
      data: {
        clientId,
        slotId: slotIds[1]!,
        serviceId,
        status: BookingStatus.CANCELLED,
        clientNameSnapshot: `KPI klientka ${suffix}`,
        clientEmailSnapshot: `kpi-${suffix}@example.test`,
        serviceNameSnapshot: `KPI služba ${suffix}`,
        serviceDurationMinutes: 60,
        servicePriceFromCzk: 500,
        finalPriceCzk: 500,
        scheduledStartsAt: cancelledStartsAt,
        scheduledEndsAt: new Date(cancelledStartsAt.getTime() + 60 * 60 * 1000),
      },
      select: { id: true },
    });
    bookingIds.push(cancelledBooking.id);

    const valueVoucher = await prisma.voucher.create({
      data: {
        code: `KPI-VALUE-${suffix}`,
        type: VoucherType.VALUE,
        status: "ACTIVE",
        originalValueCzk: 200,
        remainingValueCzk: 0,
      },
      select: { id: true },
    });
    voucherIds.push(valueVoucher.id);

    const serviceVoucher = await prisma.voucher.create({
      data: {
        code: `KPI-SERVICE-${suffix}`,
        type: VoucherType.SERVICE,
        status: "ACTIVE",
        serviceId,
        serviceNameSnapshot: `KPI služba ${suffix}`,
        originalValueCzk: 1400,
        remainingValueCzk: 0,
      },
      select: { id: true },
    });
    voucherIds.push(serviceVoucher.id);

    await prisma.bookingPayment.createMany({
      data: [
        { bookingId: booking.id, amountCzk: 300, method: BookingPaymentMethod.CASH, status: BookingPaymentStatus.ACTIVE },
        { bookingId: booking.id, amountCzk: 900, method: BookingPaymentMethod.CASH, status: BookingPaymentStatus.VOIDED, voidedAt: new Date("2099-05-10T11:00:00.000Z") },
      ],
    });

    await prisma.voucherRedemption.createMany({
      data: [
        { voucherId: valueVoucher.id, bookingId: booking.id, amountCzk: 200 },
        { voucherId: serviceVoucher.id, bookingId: booking.id, amountCzk: 1400, serviceId },
      ],
    });

    const { current, previous } = getKpiDateRanges(
      { period: "custom", dateFrom: "2099-05-10", dateTo: "2099-05-10" },
      new Date("2099-05-20T10:00:00.000Z"),
    );
    const aggregates = await getKpiPeriodAggregates(previous, current, current.end);

    assert.deepEqual(aggregates.current, { completedCount: 1, revenue: 2000, outstanding: 100 });
    assert.deepEqual(aggregates.previous, { completedCount: 0, revenue: 0, outstanding: 0 });
  } finally {
    if (redemptionBookingIds.length > 0) {
      await prisma.voucherRedemption.deleteMany({ where: { bookingId: { in: redemptionBookingIds } } });
    }
    if (paymentBookingIds.length > 0) {
      await prisma.bookingPayment.deleteMany({ where: { bookingId: { in: paymentBookingIds } } });
    }
    if (bookingIds.length > 0) {
      await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    }
    if (voucherIds.length > 0) {
      await prisma.voucher.deleteMany({ where: { id: { in: voucherIds } } });
    }
    if (slotIds.length > 0) {
      await prisma.availabilitySlot.deleteMany({ where: { id: { in: slotIds } } });
    }
    if (clientId) await prisma.client.delete({ where: { id: clientId } });
    if (serviceId) await prisma.service.delete({ where: { id: serviceId } });
    if (categoryId) await prisma.serviceCategory.delete({ where: { id: categoryId } });
  }
});
