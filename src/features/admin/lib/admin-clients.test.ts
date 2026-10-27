import assert from "node:assert/strict";
import test from "node:test";

process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";

test("getAdminClientsPageData clamps page and maps contact and visit summaries", async (t) => {
  const clientIds: Array<{ id: string }> = [];
  const clients: Array<Record<string, unknown>> = [];
  const countCalls: unknown[] = [];
  const countRow = {
    id: "client-1",
    filteredCount: 1,
    allCount: 1,
    upcomingCount: 1,
    outreachCount: 1,
    newCount: 1,
    noContactCount: 1,
    inactiveCount: 1,
    band8: 1,
    band12: 1,
    band16: 1,
  };
  const prisma = {
    client: {
      count: async (args: unknown) => {
        countCalls.push(args);
        return 1;
      },
      findMany: async () => clients,
    },
    booking: {
      findMany: async () => [],
    },
    $queryRaw: async () => [countRow],
  };
  t.mock.module("@/lib/prisma", { exports: { prisma } });

  const { getAdminClientsPageData } = await import("./admin-clients");
  const empty = await getAdminClientsPageData("owner", { view: "inactive", page: "not-a-number" });
  assert.equal(empty.filters.view, "inactive");
  assert.equal(empty.filters.page, 1);
  assert.equal(empty.clients.length, 0);
  assert.equal(empty.emptyState.title, "Nejsou evidované žádné neaktivní klientky.");

  clientIds.push({ id: "client-1" });
  const lastVisit = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
  clients.push({
    id: "client-1",
    fullName: "Jana Nováková",
    email: " jana@example.cz ",
    phone: " +420777123456 ",
    isActive: true,
    createdAt: new Date("2026-08-01T10:00:00.000Z"),
    internalNote: null,
    _count: { bookings: 2 },
    bookings: [{
      scheduledStartsAt: lastVisit,
      serviceNameSnapshot: "Manikúra",
    }],
  });
  const page = await getAdminClientsPageData("salon", {
    view: "all",
    quick: "with_booking",
    sort: "name",
    page: "999",
  });

  assert.equal(page.filters.page, 999);
  assert.equal(page.pagination.page, 1);
  assert.equal(page.filters.quick, "with_booking");
  assert.equal(page.clients.length, 1);
  assert.deepEqual(page.clients[0], {
    id: "client-1",
    href: "/admin/provoz/klienti/client-1",
    fullName: "Jana Nováková",
    email: "jana@example.cz",
    emailHref: "mailto:jana@example.cz",
    phoneDisplay: "+420 777 123 456",
    phoneHref: "tel:+420777123456",
    isActive: true,
    totalBookings: 2,
    lastVisitLabel: new Intl.DateTimeFormat("cs-CZ", {
      day: "numeric", month: "numeric", year: "numeric", timeZone: "Europe/Prague",
    }).format(lastVisit),
    lastServiceName: "Manikúra",
    weeksWithoutVisit: 2,
    nextBookingLabel: "Bez další rezervace",
    hasNote: false,
    isTestRecord: false,
  });

  const upcoming = await getAdminClientsPageData("owner", { view: "upcoming", query: "jana" });
  const newClients = await getAdminClientsPageData("owner", { quick: "new_30" });
  const noContact = await getAdminClientsPageData("owner", { view: "no_contact", quick: "noted", sort: "name" });
  const outreachReference = String(Date.now() - 60_000);
  const outreachEightWeeks = await getAdminClientsPageData("owner", {
    retention: "8_11",
    retentionAt: outreachReference,
  });
  const outreachSixteenWeeks = await getAdminClientsPageData("owner", {
    view: "outreach",
    retention: "16_plus",
  });
  const invalidFilters = await getAdminClientsPageData("owner", { view: "unknown", quick: "unknown" });

  assert.equal(upcoming.filters.view, "upcoming");
  assert.equal(upcoming.filters.query, "jana");
  assert.equal(newClients.filters.view, "new");
  assert.equal(noContact.filters.quick, "noted");
  assert.equal(noContact.pagination.page, 1);
  assert.equal(outreachEightWeeks.filters.view, "outreach");
  assert.equal(outreachEightWeeks.filters.retention, "8_11");
  assert.equal(outreachEightWeeks.filters.retentionAt, outreachReference);
  assert.equal(outreachSixteenWeeks.filters.retention, "16_plus");
  assert.equal(invalidFilters.filters.view, "all");
  assert.equal(invalidFilters.filters.quick, "all");
  assert.equal(countCalls.length, 0);
});
