import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { AdminRole, AvailabilitySlotStatus, BookingSource, BookingStatus, VoucherStatus, VoucherType } from "@/generated/prisma/client";
import type { ServiceCatalogCutoverPlan } from "./service-catalog-cutover";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("Service Catalog Cutover zachová snapshoty a SERVICE voucher na stejném serviceId", async (t) => {
  const [{ prisma }, cutover, redemptionModule, validationModule] = await Promise.all([
    import("@/lib/prisma"),
    import("./service-catalog-cutover"),
    import("@/features/vouchers/lib/voucher-redemption"),
    import("@/features/vouchers/lib/voucher-validation"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const actor = await prisma.adminUser.create({ data: { email: `cutover-${suffix}@example.com`, name: "Cutover test", role: AdminRole.OWNER } });
  const category = await prisma.serviceCategory.create({ data: { name: `Cutover ${suffix}`, slug: `cutover-${suffix}` } });
  const service = await prisma.service.create({ data: { categoryId: category.id, slug: `skin-ritual-${suffix}`, name: "REFRESH TREATMENT S MASÁŽÍ", durationMinutes: 90, priceFromCzk: 1200 } });
  const ageRenew = await prisma.service.create({ data: { categoryId: category.id, slug: `age-renew-${suffix}`, name: "ANTI AGE TREATMENT (Pro 45+)", durationMinutes: 90, priceFromCzk: 1400 } });
  const mensReset = await prisma.service.create({ data: { categoryId: category.id, slug: `mens-reset-${suffix}`, name: "MEN'S TREATMENT", durationMinutes: 90, priceFromCzk: 1000 } });
  const otherService = await prisma.service.create({ data: { categoryId: category.id, slug: `other-${suffix}`, name: "Other", durationMinutes: 60, priceFromCzk: 900 } });
  const client = await prisma.client.create({ data: { fullName: "Cutover klientka", email: `client-${suffix}@example.com`, phone: "+420777123456" } });
  const startsAt = new Date("2040-01-15T08:00:00.000Z");
  const slots = await Promise.all(Array.from({ length: 6 }, (_, offset) => prisma.availabilitySlot.create({ data: { startsAt: new Date(startsAt.getTime() + offset * 7200_000), endsAt: new Date(startsAt.getTime() + (offset * 7200_000) + 3600_000), status: AvailabilitySlotStatus.PUBLISHED, publishedAt: new Date() } })));
  const [oldSlot, newSlot, oldAgeSlot, newAgeSlot, oldMensSlot, newMensSlot] = slots;
  const oldBooking = await prisma.booking.create({ data: { clientId: client.id, slotId: oldSlot.id, serviceId: service.id, source: BookingSource.WEB, status: BookingStatus.PENDING, clientNameSnapshot: client.fullName, clientEmailSnapshot: client.email!, serviceNameSnapshot: "REFRESH TREATMENT S MASÁŽÍ", serviceDurationMinutes: 90, cleanupMinutes: 20, cleanupBlockMinutes: 30, blockedUntil: new Date(oldSlot.endsAt.getTime() + 30 * 60 * 1000), servicePriceFromCzk: 1200, scheduledStartsAt: oldSlot.startsAt, scheduledEndsAt: oldSlot.endsAt } });
  const oldAgeBooking = await prisma.booking.create({ data: { clientId: client.id, slotId: oldAgeSlot.id, serviceId: ageRenew.id, source: BookingSource.WEB, status: BookingStatus.PENDING, clientNameSnapshot: client.fullName, clientEmailSnapshot: client.email!, serviceNameSnapshot: "ANTI AGE TREATMENT (Pro 45+)", serviceDurationMinutes: 90, servicePriceFromCzk: 1400, scheduledStartsAt: oldAgeSlot.startsAt, scheduledEndsAt: oldAgeSlot.endsAt } });
  const oldMensBooking = await prisma.booking.create({ data: { clientId: client.id, slotId: oldMensSlot.id, serviceId: mensReset.id, source: BookingSource.WEB, status: BookingStatus.PENDING, clientNameSnapshot: client.fullName, clientEmailSnapshot: client.email!, serviceNameSnapshot: "MEN'S TREATMENT", serviceDurationMinutes: 90, servicePriceFromCzk: 1000, scheduledStartsAt: oldMensSlot.startsAt, scheduledEndsAt: oldMensSlot.endsAt } });
  const voucher = await prisma.voucher.create({ data: { code: `CUTOVER-${suffix}`.toUpperCase(), type: VoucherType.SERVICE, status: VoucherStatus.ACTIVE, serviceId: service.id, serviceNameSnapshot: "REFRESH TREATMENT S MASÁŽÍ", servicePriceSnapshotCzk: 950, serviceDurationSnapshot: 90, issuedAt: new Date() } });
  t.after(async () => {
    await prisma.voucherRedemption.deleteMany({ where: { voucherId: voucher.id } });
    await prisma.voucher.delete({ where: { id: voucher.id } });
    await prisma.booking.deleteMany({ where: { clientId: client.id } });
    await prisma.availabilitySlot.deleteMany({ where: { id: { in: slots.map((slot) => slot.id) } } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.servicePriceChangeLog.deleteMany({ where: { serviceId: { in: [service.id, ageRenew.id, mensReset.id] } } });
    await prisma.serviceChangeLog.deleteMany({ where: { serviceId: { in: [service.id, ageRenew.id, mensReset.id] } } });
    await prisma.service.deleteMany({ where: { id: { in: [service.id, ageRenew.id, mensReset.id, otherService.id] } } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
    await prisma.adminUser.delete({ where: { id: actor.id } });
  });

  const plan: ServiceCatalogCutoverPlan = { cutoverId: cutover.SERVICE_CATALOG_CUTOVER_ID, actorUserId: actor.id, changes: [
    { serviceId: service.id, expected: { name: "REFRESH TREATMENT S MASÁŽÍ", publicName: null, priceFromCzk: 1200, durationMinutes: 90 }, target: { name: "Skin Ritual", publicName: "Skin Ritual", priceFromCzk: 1350, durationMinutes: 100 } },
    { serviceId: ageRenew.id, expected: { name: "ANTI AGE TREATMENT (Pro 45+)", publicName: null, priceFromCzk: 1400, durationMinutes: 90 }, target: { name: "Age Renew", publicName: "Age Renew", priceFromCzk: 1500, durationMinutes: 100 } },
    { serviceId: mensReset.id, expected: { name: "MEN'S TREATMENT", publicName: null, priceFromCzk: 1000, durationMinutes: 90 }, target: { name: "Men’s Skin Reset", publicName: "Men’s Skin Reset", priceFromCzk: 1100, durationMinutes: 60 } },
  ] };
  assert.equal((await cutover.previewServiceCatalogCutover(plan))[0]?.expectedMatches, true);
  assert.deepEqual(await cutover.applyServiceCatalogCutover(plan), { status: "applied", changedServiceIds: [service.id, ageRenew.id, mensReset.id] });
  assert.deepEqual(await cutover.applyServiceCatalogCutover(plan), { status: "already-applied", changedServiceIds: [] });

  const [unchangedOldBooking, historicalBookingSnapshot, unchangedVoucher, changedService, priceLogs, changeLogs] = await Promise.all([
    prisma.booking.findMany({ where: { id: { in: [oldBooking.id, oldAgeBooking.id, oldMensBooking.id] } }, select: { serviceId: true, serviceNameSnapshot: true, serviceDurationMinutes: true, servicePriceFromCzk: true }, orderBy: { serviceId: "asc" } }),
    prisma.booking.findUniqueOrThrow({ where: { id: oldBooking.id }, select: { serviceDurationMinutes: true, cleanupMinutes: true, cleanupBlockMinutes: true, scheduledEndsAt: true, blockedUntil: true } }),
    prisma.voucher.findUniqueOrThrow({ where: { id: voucher.id }, select: { serviceId: true, serviceNameSnapshot: true, servicePriceSnapshotCzk: true } }),
    prisma.service.findMany({ where: { id: { in: [service.id, ageRenew.id, mensReset.id] } }, select: { id: true, slug: true, name: true, publicName: true, priceFromCzk: true, durationMinutes: true }, orderBy: { id: "asc" } }),
    prisma.servicePriceChangeLog.count({ where: { serviceId: { in: [service.id, ageRenew.id, mensReset.id] } } }),
    prisma.serviceChangeLog.count({ where: { serviceId: { in: [service.id, ageRenew.id, mensReset.id] } } }),
  ]);
  assert.deepEqual(unchangedOldBooking, [
    { serviceId: ageRenew.id, serviceNameSnapshot: "ANTI AGE TREATMENT (Pro 45+)", serviceDurationMinutes: 90, servicePriceFromCzk: 1400 },
    { serviceId: mensReset.id, serviceNameSnapshot: "MEN'S TREATMENT", serviceDurationMinutes: 90, servicePriceFromCzk: 1000 },
    { serviceId: service.id, serviceNameSnapshot: "REFRESH TREATMENT S MASÁŽÍ", serviceDurationMinutes: 90, servicePriceFromCzk: 1200 },
  ].sort((a, b) => a.serviceId.localeCompare(b.serviceId)));
  assert.deepEqual(historicalBookingSnapshot, {
    serviceDurationMinutes: 90,
    cleanupMinutes: 20,
    cleanupBlockMinutes: 30,
    scheduledEndsAt: oldSlot.endsAt,
    blockedUntil: new Date(oldSlot.endsAt.getTime() + 30 * 60 * 1000),
  });
  assert.deepEqual(unchangedVoucher, { serviceId: service.id, serviceNameSnapshot: "REFRESH TREATMENT S MASÁŽÍ", servicePriceSnapshotCzk: 950 });
  assert.deepEqual(changedService.map(({ id, name, durationMinutes, priceFromCzk }) => ({ id, name, durationMinutes, priceFromCzk })), [
    { id: ageRenew.id, name: "Age Renew", durationMinutes: 100, priceFromCzk: 1500 },
    { id: mensReset.id, name: "Men’s Skin Reset", durationMinutes: 60, priceFromCzk: 1100 },
    { id: service.id, name: "Skin Ritual", durationMinutes: 100, priceFromCzk: 1350 },
  ].sort((a, b) => a.id.localeCompare(b.id)));
  assert.equal(priceLogs, 3);
  assert.equal(changeLogs, 3);

  const newBookings = await Promise.all([
    [service, newSlot, "Skin Ritual", 100, 1350], [ageRenew, newAgeSlot, "Age Renew", 100, 1500], [mensReset, newMensSlot, "Men’s Skin Reset", 60, 1100],
  ].map(([nextService, slot, serviceNameSnapshot, serviceDurationMinutes, servicePriceFromCzk]) => prisma.booking.create({ data: { clientId: client.id, slotId: (slot as typeof newSlot).id, serviceId: (nextService as typeof service).id, source: BookingSource.WEB, status: BookingStatus.COMPLETED, clientNameSnapshot: client.fullName, clientEmailSnapshot: client.email!, serviceNameSnapshot: serviceNameSnapshot as string, serviceDurationMinutes: serviceDurationMinutes as number, servicePriceFromCzk: servicePriceFromCzk as number, scheduledStartsAt: (slot as typeof newSlot).startsAt, scheduledEndsAt: (slot as typeof newSlot).endsAt } })));
  const newBooking = newBookings[0]!;
  assert.deepEqual(newBookings.map(({ serviceNameSnapshot, serviceDurationMinutes, servicePriceFromCzk }) => ({ serviceNameSnapshot, serviceDurationMinutes, servicePriceFromCzk })), [
    { serviceNameSnapshot: "Skin Ritual", serviceDurationMinutes: 100, servicePriceFromCzk: 1350 },
    { serviceNameSnapshot: "Age Renew", serviceDurationMinutes: 100, servicePriceFromCzk: 1500 },
    { serviceNameSnapshot: "Men’s Skin Reset", serviceDurationMinutes: 60, servicePriceFromCzk: 1100 },
  ]);
  const validation = await validationModule.validateVoucherForBookingInput({ code: voucher.code, serviceId: service.id });
  assert.equal(validation.ok, true);
  const mismatch = await validationModule.validateVoucherForBookingInput({ code: voucher.code, serviceId: otherService.id });
  assert.deepEqual(mismatch, { ok: false, reason: "SERVICE_MISMATCH", serviceNameSnapshot: "REFRESH TREATMENT S MASÁŽÍ" });
  const redeemed = await redemptionModule.redeemVoucherForBooking({ voucherCode: voucher.code, bookingId: newBooking.id, redeemedByUserId: actor.id, note: undefined });
  assert.equal(redeemed.redemption.amountCzk, 950);
});
