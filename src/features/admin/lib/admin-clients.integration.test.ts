import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { BookingStatus } from "@prisma/client";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("admin clients řadí a stránkuje globálně před načtením profilů", async () => {
  const [{ prisma }, { getAdminClientsPageData }] = await Promise.all([
    import("@/lib/prisma"),
    import("./admin-clients"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const reference = new Date();
  reference.setMilliseconds(0);
  const clientIds: string[] = [];
  const bookingIds: string[] = [];
  let ownerId = "";
  let categoryId = "";
  let serviceId = "";
  let slotId = "";

  const createClient = async (fullName: string, createdAt: Date) => {
    const client = await prisma.client.create({
      data: { fullName, email: `${fullName.replaceAll(" ", "-").toLowerCase()}-${suffix}@example.test`, createdAt },
      select: { id: true },
    });
    clientIds.push(client.id);
    return client.id;
  };

  try {
    const owner = await prisma.adminUser.create({
      data: { email: `owner-clients-${suffix}@example.test`, name: `Owner ${suffix}`, role: "OWNER", isActive: true },
      select: { id: true },
    });
    ownerId = owner.id;
    const category = await prisma.serviceCategory.create({
      data: { name: `Kategorie klienti ${suffix}`, slug: `kategorie-klienti-${suffix}`, isActive: true },
      select: { id: true },
    });
    categoryId = category.id;
    const service = await prisma.service.create({
      data: { categoryId, name: `Služba klienti ${suffix}`, slug: `sluzba-klienti-${suffix}`, durationMinutes: 60, priceFromCzk: 1000, isActive: true, isPubliclyBookable: true },
      select: { id: true },
    });
    serviceId = service.id;
    const slot = await prisma.availabilitySlot.create({
      data: {
        startsAt: new Date(reference.getTime() + 86_400_000),
        endsAt: new Date(reference.getTime() + 2 * 86_400_000),
        status: "ARCHIVED",
        capacity: 1,
        serviceRestrictionMode: "ANY",
        createdByUserId: ownerId,
      },
      select: { id: true },
    });
    slotId = slot.id;

    const priorityId = await createClient(`Prioritní ${suffix}`, new Date(reference.getTime() - 90 * 86_400_000));
    const tieOldId = await createClient(`Shoda starší ${suffix}`, new Date(reference.getTime() - 20 * 86_400_000));
    const tieNewId = await createClient(`Shoda novější ${suffix}`, new Date(reference.getTime() - 10 * 86_400_000));
    const retentionId = await createClient(`Retence ${suffix}`, new Date(reference.getTime() - 70 * 86_400_000));
    const bookedMostId = await createClient(`Rezervace nejvíc ${suffix}`, new Date(reference.getTime() - 5 * 86_400_000));
    for (let index = 0; index < 48; index += 1) {
      await createClient(`Profil ${String(index).padStart(2, "0")} ${suffix}`, new Date(reference.getTime() - (index + 1) * 86_400_000));
    }
    await createClient(`Bez návštěvy A ${suffix}`, new Date(reference.getTime() - 2 * 86_400_000));
    await createClient(`Bez návštěvy B ${suffix}`, new Date(reference.getTime() - 86_400_000));

    const createBooking = async (clientId: string, scheduledStartsAt: Date, status = BookingStatus.COMPLETED) => {
      const booking = await prisma.booking.create({
        data: {
          clientId,
          slotId,
          serviceId,
          status,
          source: "WEB",
          clientNameSnapshot: `Klientka ${suffix}`,
          clientEmailSnapshot: `klientka-${suffix}@example.test`,
          serviceNameSnapshot: `Služba klienti ${suffix}`,
          serviceDurationMinutes: 60,
          servicePriceFromCzk: 1000,
          scheduledStartsAt,
          scheduledEndsAt: new Date(scheduledStartsAt.getTime() + 3_600_000),
        },
        select: { id: true },
      });
      bookingIds.push(booking.id);
    };

    await createBooking(priorityId, new Date(reference.getTime() - 86_400_000));
    await createBooking(tieOldId, new Date(reference.getTime() - 2 * 86_400_000));
    await createBooking(tieNewId, new Date(reference.getTime() - 2 * 86_400_000));
    await createBooking(retentionId, new Date(reference.getTime() - 9 * 7 * 86_400_000));
    for (let index = 0; index < 3; index += 1) await createBooking(bookedMostId, new Date(reference.getTime() - (index + 3) * 86_400_000));
    for (const [index, clientId] of clientIds.slice(5, 53).entries()) {
      await createBooking(clientId, new Date(reference.getTime() - (index + 4) * 86_400_000));
    }

    const baseParams = { query: suffix, retentionAt: String(reference.getTime()) };
    const recentFirst = await getAdminClientsPageData("owner", { ...baseParams, sort: "recent", page: "1" });
    const recentSecond = await getAdminClientsPageData("owner", { ...baseParams, sort: "recent", page: "2" });
    const recentRepeat = await getAdminClientsPageData("owner", { ...baseParams, sort: "recent", page: "1" });

    assert.equal(recentFirst.pagination.totalCount, 55);
    assert.equal(recentFirst.clients[0]?.fullName, `Prioritní ${suffix}`);
    assert.ok(recentFirst.clients.findIndex((client) => client.fullName === `Shoda novější ${suffix}`) < recentFirst.clients.findIndex((client) => client.fullName === `Shoda starší ${suffix}`));
    assert.deepEqual(recentFirst.clients.map((client) => client.id), recentRepeat.clients.map((client) => client.id));
    assert.equal(recentSecond.clients.length, 5);
    assert.equal(new Set([...recentFirst.clients, ...recentSecond.clients].map((client) => client.id)).size, 55);
    assert.equal(recentSecond.clients.at(-1)?.fullName, `Bez návštěvy A ${suffix}`);

    const beyondLastPage = await getAdminClientsPageData("owner", { ...baseParams, sort: "recent", page: "99" });
    assert.equal(beyondLastPage.pagination.page, 2);
    assert.equal(beyondLastPage.pagination.lastItemNumber, 55);

    const bookings = await getAdminClientsPageData("owner", { ...baseParams, sort: "bookings" });
    assert.equal(bookings.clients[0]?.fullName, `Rezervace nejvíc ${suffix}`);
    const byName = await getAdminClientsPageData("owner", { ...baseParams, sort: "name" });
    assert.equal(byName.clients[0]?.fullName, `Bez návštěvy A ${suffix}`);
    const byCreated = await getAdminClientsPageData("owner", { ...baseParams, sort: "created" });
    assert.equal(byCreated.clients[0]?.fullName, `Bez návštěvy B ${suffix}`);

    const retention = await getAdminClientsPageData("owner", { ...baseParams, retention: "8_11", page: "1" });
    assert.deepEqual(retention.clients.map((client) => client.fullName), [`Retence ${suffix}`]);
    assert.equal(retention.filters.retentionAt, String(reference.getTime()));

    const band12Id = await createClient(`Retence 13 ${suffix}`, new Date(reference.getTime() - 100 * 86_400_000));
    const band16Id = await createClient(`Retence 17 ${suffix}`, new Date(reference.getTime() - 130 * 86_400_000));
    const noContact = await prisma.client.create({ data: { fullName: `Bez kontaktu ${suffix}` }, select: { id: true } });
    clientIds.push(noContact.id);
    const inactive = await prisma.client.create({ data: { fullName: `Neaktivní ${suffix}`, isActive: false }, select: { id: true } });
    clientIds.push(inactive.id);
    await createBooking(band12Id, new Date(reference.getTime() - 13 * 7 * 86_400_000));
    await createBooking(band16Id, new Date(reference.getTime() - 17 * 7 * 86_400_000));
    await createBooking(priorityId, new Date(reference.getTime() + 2 * 86_400_000), BookingStatus.PENDING);

    const upcoming = await getAdminClientsPageData("owner", { query: suffix, view: "upcoming" });
    assert.deepEqual(upcoming.clients.map((client) => client.id), [priorityId]);
    const outreach = await getAdminClientsPageData("owner", { query: suffix, view: "outreach", retentionAt: String(reference.getTime()) });
    assert.ok(!outreach.clients.some((client) => client.id === priorityId));
    assert.equal(outreach.outreach.bands.find((band) => band.value === "8_11")?.count, 1);
    assert.equal(outreach.outreach.bands.find((band) => band.value === "12_15")?.count, 1);
    assert.equal(outreach.outreach.bands.find((band) => band.value === "16_plus")?.count, 1);
    const noContactView = await getAdminClientsPageData("owner", { query: suffix, view: "no_contact" });
    assert.deepEqual(noContactView.clients.map((client) => client.id), [noContact.id]);
    const inactiveView = await getAdminClientsPageData("owner", { query: suffix, view: "inactive" });
    assert.deepEqual(inactiveView.clients.map((client) => client.id), [inactive.id]);
    assert.equal((await getAdminClientsPageData("owner", { query: suffix, quick: "no_contact" })).filters.view, "no_contact");
    assert.equal((await getAdminClientsPageData("owner", { query: suffix, status: "inactive" })).filters.view, "inactive");
    assert.equal((await getAdminClientsPageData("salon", { view: "outreach" })).views.find((view) => view.value === "outreach")?.href.startsWith("/admin/provoz/klienti?"), true);
  } finally {
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
    if (slotId) await prisma.availabilitySlot.deleteMany({ where: { id: slotId } });
    if (serviceId) await prisma.service.deleteMany({ where: { id: serviceId } });
    if (categoryId) await prisma.serviceCategory.deleteMany({ where: { id: categoryId } });
    if (ownerId) await prisma.adminUser.deleteMany({ where: { id: ownerId } });
  }
});
