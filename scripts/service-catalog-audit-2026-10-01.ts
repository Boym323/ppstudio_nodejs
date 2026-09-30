import "dotenv/config";

import { BookingStatus, VoucherStatus, VoucherType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

async function main() {
  const now = new Date();
  const [services, activeServiceVouchers, futureBookings, invalidVouchers] = await Promise.all([
    prisma.service.findMany({
      select: { id: true, slug: true, name: true, publicName: true, priceFromCzk: true, durationMinutes: true },
      orderBy: [{ slug: "asc" }, { id: "asc" }],
    }),
    prisma.voucher.groupBy({
      by: ["serviceId"],
      where: { type: VoucherType.SERVICE, status: { in: [VoucherStatus.ACTIVE, VoucherStatus.PARTIALLY_REDEEMED] } },
      _count: { _all: true },
    }),
    prisma.booking.groupBy({
      by: ["serviceId"],
      where: { status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] }, scheduledStartsAt: { gte: now } },
      _count: { _all: true },
    }),
    prisma.voucher.findMany({
      where: { type: VoucherType.SERVICE },
      select: {
        id: true,
        code: true,
        status: true,
        serviceId: true,
        serviceNameSnapshot: true,
        servicePriceSnapshotCzk: true,
        serviceDurationSnapshot: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const invalidServiceVouchers = invalidVouchers.filter((voucher) => (
    voucher.serviceId === null
    || !voucher.serviceNameSnapshot?.trim()
    || voucher.servicePriceSnapshotCzk === null
    || voucher.serviceDurationSnapshot === null
  ));
  const vouchersByService = new Map(activeServiceVouchers.map((item) => [item.serviceId, item._count._all]));
  const bookingsByService = new Map(futureBookings.map((item) => [item.serviceId, item._count._all]));
  console.log(JSON.stringify({
    generatedAt: now.toISOString(),
    services: services.map((service) => ({
      ...service,
      activeServiceVouchers: vouchersByService.get(service.id) ?? 0,
      futurePendingOrConfirmedBookings: bookingsByService.get(service.id) ?? 0,
    })),
    serviceVoucherIntegrity: { valid: invalidServiceVouchers.length === 0, invalidVouchers: invalidServiceVouchers },
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
