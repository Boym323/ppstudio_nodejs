import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { AdminRole, BookingActorType, BookingStatus, BookingSubmissionOutcome, EmailLogType, ServiceChangeOperation, VoucherChangeOperation, VoucherType } from "@prisma/client";

import { formatServicePrice } from "./admin-service-format";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("admin logy rozliší submission typy, Pozornost a SALON scope", async () => {
  const [{ prisma }, { getAdminLogsData }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-data"),
  ]);
  const suffix = `admin-logs-${randomUUID()}`;

  try {
    await prisma.bookingSubmissionLog.createMany({
      data: [
        { outcome: BookingSubmissionOutcome.FAILED, failureCode: "ADMIN_LOGIN_INVALID_CREDENTIALS", failureReason: `Neplatný login ${suffix}` },
        { outcome: BookingSubmissionOutcome.FAILED, failureCode: "PUBLIC_VOUCHER_VERIFY_PUBLIC_PAGE_NOT_FOUND_OR_INVALID", failureReason: `Neplatný voucher ${suffix}` },
        { outcome: BookingSubmissionOutcome.FAILED, failureCode: "VALIDATION_ERROR", failureReason: `Běžná validace ${suffix}` },
        { outcome: BookingSubmissionOutcome.FAILED, failureCode: "UNEXPECTED_ERROR", failureReason: `Kritická chyba ${suffix}` },
      ],
    });

    const system = await getAdminLogsData({ area: "owner", view: "system", query: suffix });
    assert.deepEqual(new Set(system.items.map((item) => item.title)), new Set([
      "Přihlášení administrátora",
      "Veřejné ověření voucheru",
      "Odeslání rezervace selhalo",
    ]));
    assert.equal(system.items.find((item) => item.description?.startsWith("Neplatný login"))?.severity, "info");
    assert.equal(system.items.find((item) => item.description?.startsWith("Kritická chyba"))?.severity, "error");

    const systemInfo = await getAdminLogsData({ area: "owner", view: "system", query: suffix, severity: "info" });
    assert.equal(systemInfo.items.length, 3);
    assert.equal(systemInfo.items.every((item) => item.severity === "info"), true);
    const systemErrors = await getAdminLogsData({ area: "owner", view: "system", query: suffix, severity: "error" });
    assert.deepEqual(systemErrors.items.map((item) => item.description), [`Kritická chyba ${suffix}`]);

    const attention = await getAdminLogsData({ area: "owner", view: "attention", query: suffix });
    assert.deepEqual(attention.items.map((item) => item.description), [`Kritická chyba ${suffix}`]);
    assert.ok(attention.attention.critical >= 1);

    const salonAttention = await getAdminLogsData({ area: "salon", view: "attention", query: suffix });
    assert.equal(salonAttention.items.some((item) => item.sourceType === "submission"), false);
    assert.equal(salonAttention.attention.critical, 0);
  } finally {
    await prisma.bookingSubmissionLog.deleteMany({ where: { failureReason: { contains: suffix } } });
  }
});

dbTest("admin logy používají české popisky voucheru a název kategorie služby", async () => {
  const [{ prisma }, { getAdminLogsData }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-data"),
  ]);
  const suffix = randomUUID();
  const actor = await prisma.adminUser.create({ data: { email: `admin-log-labels-${suffix}@example.com`, name: "Audit popisků", role: AdminRole.SALON } });
  const previousCategory = await prisma.serviceCategory.create({ data: { name: `Původní kategorie ${suffix}`, slug: `puvodni-${suffix}` } });
  const nextCategory = await prisma.serviceCategory.create({ data: { name: `Nová kategorie ${suffix}`, slug: `nova-${suffix}` } });
  const service = await prisma.service.create({ data: { categoryId: nextCategory.id, name: `Služba ${suffix}`, slug: `sluzba-${suffix}`, durationMinutes: 60 } });
  const voucher = await prisma.voucher.create({ data: { code: `AUDIT-${suffix}`, type: VoucherType.VALUE, originalValueCzk: 1000, remainingValueCzk: 1000 } });

  try {
    await prisma.serviceChangeLog.create({
      data: {
        serviceId: service.id,
        actorUserId: actor.id,
        operation: ServiceChangeOperation.UPDATE_OPERATIONAL_DETAILS,
        before: { categoryId: { categoryId: previousCategory.id, categoryName: previousCategory.name } },
        after: { categoryId: { categoryId: nextCategory.id, categoryName: nextCategory.name } },
      },
    });
    await prisma.voucherChangeLog.create({
      data: { voucherId: voucher.id, actorUserId: actor.id, operation: VoucherChangeOperation.UPDATE_OPERATIONAL_DETAILS, before: { purchaserNameChanged: false, purchaserEmailChanged: false }, after: { purchaserNameChanged: true, purchaserEmailChanged: true } },
    });

    await prisma.serviceCategory.delete({ where: { id: previousCategory.id } });

    const serviceLogs = await getAdminLogsData({ area: "salon", view: "events", source: "service", query: suffix });
    assert.equal(serviceLogs.items[0]?.description, `Kategorie: Původní kategorie ${suffix} → Nová kategorie ${suffix}`);
    const voucherLogs = await getAdminLogsData({ area: "salon", view: "events", source: "voucher", query: suffix });
    assert.equal(voucherLogs.items[0]?.description, "Jméno kupujícího: upraveno • E-mail kupujícího: upraveno");
  } finally {
    await prisma.voucherChangeLog.deleteMany({ where: { voucherId: voucher.id } });
    await prisma.serviceChangeLog.deleteMany({ where: { serviceId: service.id } });
    await prisma.voucher.delete({ where: { id: voucher.id } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: nextCategory.id } });
    await prisma.adminUser.delete({ where: { id: actor.id } });
  }
});

dbTest("admin logy zobrazují každou změnu ceny služby právě jednou", async () => {
  const [{ prisma }, { getAdminLogsData }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-data"),
  ]);
  const suffix = randomUUID();
  const actor = await prisma.adminUser.create({ data: { email: `admin-price-log-${suffix}@example.com`, name: "Cenový audit", role: AdminRole.SALON } });
  const category = await prisma.serviceCategory.create({ data: { name: `Kategorie ceny ${suffix}`, slug: `kategorie-ceny-${suffix}` } });
  const service = await prisma.service.create({ data: { categoryId: category.id, name: `Služba ceny ${suffix}`, slug: `sluzba-ceny-${suffix}`, durationMinutes: 60 } });

  try {
    await prisma.servicePriceChangeLog.createMany({
      data: [
        { serviceId: service.id, changedByUserId: actor.id, oldPriceFromCzk: 1390, newPriceFromCzk: 1490 },
        { serviceId: service.id, changedByUserId: actor.id, oldPriceFromCzk: null, newPriceFromCzk: 1490 },
        { serviceId: service.id, changedByUserId: actor.id, oldPriceFromCzk: 1490, newPriceFromCzk: null },
      ],
    });
    await prisma.serviceChangeLog.create({
      data: {
        serviceId: service.id,
        actorUserId: actor.id,
        operation: ServiceChangeOperation.UPDATE_OPERATIONAL_DETAILS,
        before: { isActive: true },
        after: { isActive: false },
      },
    });

    const feed = await getAdminLogsData({ area: "salon", view: "events", source: "service", query: suffix });
    const priceChanges = feed.items.filter((item) => item.title === "Cena služby změněna");

    assert.equal(priceChanges.length, 3);
    assert.deepEqual(new Set(priceChanges.map((item) => item.description)), new Set([
      `${formatServicePrice(1390)} → ${formatServicePrice(1490)}`,
      `${formatServicePrice(null)} → ${formatServicePrice(1490)}`,
      `${formatServicePrice(1490)} → ${formatServicePrice(null)}`,
    ]));
    assert.equal(priceChanges.every((item) => item.actorLabel === actor.name && item.entityLabel === service.name && item.severity === "info"), true);
    assert.equal(feed.items.filter((item) => item.title === "Služba upravena").length, 1);
    assert.equal(feed.total, 4);
  } finally {
    await prisma.serviceChangeLog.deleteMany({ where: { serviceId: service.id } });
    await prisma.servicePriceChangeLog.deleteMany({ where: { serviceId: service.id } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
    await prisma.adminUser.delete({ where: { id: actor.id } });
  }
});

dbTest("admin logy dávají provoznímu booking auditu přednost před stavem rezervace", async () => {
  const [{ prisma }, { getAdminLogsData }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-data"),
  ]);
  const suffix = randomUUID();
  const startsAt = new Date("2027-01-14T09:00:00.000Z");
  const endsAt = new Date("2027-01-14T10:00:00.000Z");
  const category = await prisma.serviceCategory.create({ data: { name: `Kategorie ${suffix}`, slug: `kategorie-${suffix}` } });
  const service = await prisma.service.create({ data: { categoryId: category.id, name: `Služba ${suffix}`, slug: `sluzba-${suffix}`, durationMinutes: 60 } });
  const slot = await prisma.availabilitySlot.create({ data: { startsAt, endsAt, status: "PUBLISHED", capacity: 1 } });
  const client = await prisma.client.create({ data: { fullName: `Klientka ${suffix}`, email: `admin-log-${suffix}@example.com`, phone: "+420777123456", isActive: true } });
  const booking = await prisma.booking.create({
    data: {
      clientId: client.id, slotId: slot.id, serviceId: service.id, status: BookingStatus.CONFIRMED, source: "WEB",
      clientNameSnapshot: client.fullName, clientEmailSnapshot: client.email!, clientPhoneSnapshot: client.phone,
      serviceNameSnapshot: service.name, serviceDurationMinutes: 60, servicePriceFromCzk: 1200,
      scheduledStartsAt: startsAt, scheduledEndsAt: endsAt,
    },
  });

  try {
    await prisma.bookingStatusHistory.createMany({
      data: [
        { bookingId: booking.id, status: BookingStatus.CONFIRMED, actorType: BookingActorType.USER, reason: "Potvrzeno administrátorkou", metadata: { source: "admin-booking-detail-v2", fromStatus: "PENDING", toStatus: "CONFIRMED" } },
        { bookingId: booking.id, status: BookingStatus.CONFIRMED, actorType: BookingActorType.USER, reason: "Individuální cena upravena", metadata: { source: "admin-booking-price-update-v1" } },
        { bookingId: booking.id, status: BookingStatus.CONFIRMED, actorType: BookingActorType.USER, reason: "Interní poznámka upravena", metadata: { source: "admin-booking-note-v1" } },
        { bookingId: booking.id, status: BookingStatus.CONFIRMED, actorType: BookingActorType.USER, reason: "Kontakt klientky upraven", metadata: { source: "admin-client-contact-update-v1" } },
        { bookingId: booking.id, status: BookingStatus.CONFIRMED, actorType: BookingActorType.USER, reason: "Platba upravena", metadata: { source: "admin-booking-payment-update-v1" } },
      ],
    });

    const [all, info, success] = await Promise.all([
      getAdminLogsData({ area: "salon", view: "events", source: "booking", query: suffix }),
      getAdminLogsData({ area: "salon", view: "events", source: "booking", query: suffix, severity: "info" }),
      getAdminLogsData({ area: "salon", view: "events", source: "booking", query: suffix, severity: "success" }),
    ]);
    assert.equal(all.items.find((item) => item.title === "Cena rezervace upravena")?.severity, "info");
    assert.deepEqual(new Set(info.items.map((item) => item.title)), new Set(["Cena rezervace upravena", "Interní poznámka upravena", "Kontakt klientky upraven", "Platba upravena"]));
    assert.deepEqual(success.items.map((item) => item.title), ["Rezervace potvrzena"]);
  } finally {
    await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: booking.id } });
    await prisma.booking.delete({ where: { id: booking.id } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.availabilitySlot.delete({ where: { id: slot.id } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
  }
});

dbTest("admin event feed potlačí jen booking audit kanonického voucherového čerpání", async () => {
  const [{ prisma }, { getAdminLogsData }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-data"),
  ]);
  const suffix = randomUUID();
  const category = await prisma.serviceCategory.create({ data: { name: `Kategorie voucher feed ${suffix}`, slug: `voucher-feed-${suffix}` } });
  const service = await prisma.service.create({ data: { categoryId: category.id, name: `Služba voucher feed ${suffix}`, slug: `sluzba-voucher-feed-${suffix}`, durationMinutes: 60 } });
  const client = await prisma.client.create({ data: { fullName: `Klientka voucher feed ${suffix}`, email: `voucher-feed-${suffix}@example.com`, phone: "+420777123456", isActive: true } });
  const slots = await Promise.all([0, 1, 2].map((offset) => prisma.availabilitySlot.create({ data: { startsAt: new Date(`2027-02-0${offset + 1}T09:00:00.000Z`), endsAt: new Date(`2027-02-0${offset + 1}T10:00:00.000Z`), status: "PUBLISHED", capacity: 1 } })));
  const [voucher, secondVoucher, thirdVoucher] = await Promise.all([1, 2, 3].map((number) => prisma.voucher.create({ data: { code: `FEED-${number}-${suffix}`, type: VoucherType.VALUE, originalValueCzk: 500, remainingValueCzk: 500 } })));
  const bookings = await Promise.all(slots.map((slot, index) => prisma.booking.create({ data: {
    clientId: client.id, slotId: slot.id, serviceId: service.id, status: BookingStatus.COMPLETED, source: "WEB",
    clientNameSnapshot: client.fullName, clientEmailSnapshot: client.email!, clientPhoneSnapshot: client.phone, serviceNameSnapshot: service.name,
    serviceDurationMinutes: 60, servicePriceFromCzk: 1000, scheduledStartsAt: slot.startsAt, scheduledEndsAt: slot.endsAt,
    ...(index === 0 ? { finalPriceCzk: 1000 } : {}),
  } })));

  try {
    await prisma.voucherRedemption.createMany({ data: [
      { voucherId: voucher.id, bookingId: bookings[0].id, amountCzk: 500 },
      { voucherId: secondVoucher.id, bookingId: bookings[2].id, amountCzk: 300 },
      { voucherId: thirdVoucher.id, bookingId: bookings[2].id, amountCzk: 200 },
    ] });
    await prisma.bookingStatusHistory.createMany({ data: [
      { bookingId: bookings[0].id, status: BookingStatus.COMPLETED, actorType: BookingActorType.USER, reason: "Voucher uplatněn při dokončení návštěvy", metadata: { source: "admin-booking-complete-flow-v1", voucherCode: voucher.code } },
      { bookingId: bookings[0].id, status: BookingStatus.COMPLETED, actorType: BookingActorType.USER, reason: "Platba zapsána při dokončení návštěvy", metadata: { source: "admin-booking-complete-flow-v1" } },
      { bookingId: bookings[0].id, status: BookingStatus.COMPLETED, actorType: BookingActorType.USER, reason: "Dokončeno" },
      { bookingId: bookings[1].id, status: BookingStatus.COMPLETED, actorType: BookingActorType.USER, reason: "Dokončeno" },
      { bookingId: bookings[1].id, status: BookingStatus.COMPLETED, actorType: BookingActorType.USER, reason: "Voucher uplatněn při dokončení návštěvy", metadata: { source: "admin-booking-complete-flow-v1", voucherCode: `LEGACY-${suffix}` } },
      { bookingId: bookings[2].id, status: BookingStatus.COMPLETED, actorType: BookingActorType.USER, reason: "Voucher uplatněn při dokončení návštěvy", metadata: { source: "admin-booking-complete-flow-v1", voucherCode: secondVoucher.code } },
      { bookingId: bookings[2].id, status: BookingStatus.COMPLETED, actorType: BookingActorType.USER, reason: "Voucher uplatněn při dokončení návštěvy", metadata: { source: "admin-booking-complete-flow-v1", voucherCode: thirdVoucher.code } },
      { bookingId: bookings[2].id, status: BookingStatus.COMPLETED, actorType: BookingActorType.USER, reason: "Dokončeno" },
    ] });

    const feed = await getAdminLogsData({ area: "salon", view: "events", query: suffix });
    assert.equal(feed.items.filter((item) => item.title === "Voucher uplatněn").length, 3);
    assert.equal(feed.items.filter((item) => item.title === "Platba zaznamenána").length, 1);
    assert.equal(feed.items.filter((item) => item.title === "Rezervace dokončena").length, 3);
    assert.equal(feed.items.filter((item) => item.title === "Voucher uplatněn při dokončení návštěvy").length, 1);
    assert.equal(feed.items.filter((item) => item.title === "Voucher uplatněn").every((item) => item.severity === "success"), true);
    assert.equal(feed.items.find((item) => item.title === "Platba zaznamenána")?.severity, "info");
    assert.equal(feed.items.filter((item) => item.title === "Rezervace dokončena").every((item) => item.severity === "success"), true);
    assert.equal(feed.total, 11);
    assert.equal(feed.items.every((item, index, items) => index === 0 || items[index - 1].occurredAt >= item.occurredAt), true);
  } finally {
    await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: { in: bookings.map((booking) => booking.id) } } });
    await prisma.voucherRedemption.deleteMany({ where: { bookingId: { in: bookings.map((booking) => booking.id) } } });
    await prisma.booking.deleteMany({ where: { id: { in: bookings.map((booking) => booking.id) } } });
    await prisma.voucher.deleteMany({ where: { id: { in: [voucher.id, secondVoucher.id, thirdVoucher.id] } } });
    await prisma.availabilitySlot.deleteMany({ where: { id: { in: slots.map((slot) => slot.id) } } });
    await prisma.client.delete({ where: { id: client.id } });
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
  }
});

dbTest("admin logy filtrují a popisují oba lifecycle e-maily rezervace", async () => {
  const [{ prisma }, { getAdminLogsData, getEmailLogDetailData }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-data"),
  ]);
  const suffix = randomUUID();

  try {
    await prisma.emailLog.createMany({
      data: [
        {
          type: EmailLogType.BOOKING_RECEIVED,
          recipientEmail: `received-${suffix}@example.com`,
          subject: `Přijetí rezervace ${suffix}`,
          templateKey: "booking-confirmation-v1",
        },
        {
          type: EmailLogType.BOOKING_CONFIRMED,
          recipientEmail: `confirmed-${suffix}@example.com`,
          subject: `Potvrzení rezervace ${suffix}`,
          templateKey: "booking-approved-v1",
        },
      ],
    });

    const received = await getAdminLogsData({ area: "owner", view: "emails", query: suffix, emailType: EmailLogType.BOOKING_RECEIVED });
    const confirmed = await getAdminLogsData({ area: "owner", view: "emails", query: suffix, emailType: EmailLogType.BOOKING_CONFIRMED });
    const [receivedLog, confirmedLog] = await Promise.all([
      prisma.emailLog.findFirstOrThrow({ where: { recipientEmail: `received-${suffix}@example.com` }, select: { id: true } }),
      prisma.emailLog.findFirstOrThrow({ where: { recipientEmail: `confirmed-${suffix}@example.com` }, select: { id: true } }),
    ]);
    const [receivedDetail, confirmedDetail] = await Promise.all([
      getEmailLogDetailData(receivedLog.id),
      getEmailLogDetailData(confirmedLog.id),
    ]);

    assert.equal(received.items[0]?.title, `Přijetí rezervace ${suffix}`);
    assert.equal(confirmed.items[0]?.title, `Potvrzení rezervace ${suffix}`);
    assert.equal(receivedDetail?.typeLabel, "Přijetí rezervace");
    assert.equal(confirmedDetail?.typeLabel, "Potvrzení rezervace");
  } finally {
    await prisma.emailLog.deleteMany({ where: { subject: { contains: suffix } } });
  }
});
