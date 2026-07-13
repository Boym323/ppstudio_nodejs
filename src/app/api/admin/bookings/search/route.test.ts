import assert from "node:assert/strict";
import test from "node:test";
import { AdminRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.ADMIN_OWNER_PASSWORD ??= "change-me-owner";
process.env.ADMIN_STAFF_EMAIL ??= "staff@example.com";
process.env.ADMIN_STAFF_PASSWORD ??= "change-me-staff";
process.env.EMAIL_DELIVERY_MODE ??= "log";

function mockFindClients(value: unknown) {
  return (async () => value) as typeof prisma.client.findMany;
}

function mockFindServices(value: unknown) {
  return (async () => value) as typeof prisma.service.findMany;
}

function mockFindClientsFailure(message: string) {
  return (async () => {
    throw new Error(message);
  }) as typeof prisma.client.findMany;
}

function mockFindServicesFailure(message: string) {
  return (async () => {
    throw new Error(message);
  }) as typeof prisma.service.findMany;
}

function createSearchRequest(query: string) {
  return new Request("https://example.com/api/admin/bookings/search", {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

test("booking search route rejects unauthenticated access", async () => {
  const { createAdminBookingSearchRouteApi } = await import("./route");
  const api = createAdminBookingSearchRouteApi({
    getSession: async () => null,
    isSameOriginAdminRequest: () => true,
    findClients: mockFindClientsFailure("findClients should not run without session"),
    findServices: mockFindServicesFailure("findServices should not run without session"),
  });

  const response = await api.POST(createSearchRequest("anna"));

  assert.equal(response.status, 403);
});

test("booking search route returns deduplicated suggestions from clients and services", async () => {
  const { createAdminBookingSearchRouteApi } = await import("./route");
  const api = createAdminBookingSearchRouteApi({
    getSession: async () => ({
      sub: "admin-1",
      role: AdminRole.OWNER,
      email: "owner@example.com",
      name: "Owner",
      iat: 1,
      exp: 999999,
    }),
    isSameOriginAdminRequest: () => true,
    findClients: mockFindClients([
      {
        fullName: "Anna Novak",
        email: "anna@example.com",
        phone: "+420777123456",
      },
    ]),
    findServices: mockFindServices([
      {
        name: "Kosmetické ošetření",
        category: {
          name: "Pleť",
        },
      },
    ]),
  });

  const response = await api.POST(createSearchRequest("anna"));
  const payload = (await response.json()) as {
    status: string;
    suggestions: Array<{
      value: string;
      label: string;
      detail: string;
      kind: string;
    }>;
  };

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(payload.status, "success");
  assert.equal(payload.suggestions.length, 2);
  assert.equal(payload.suggestions[0]?.label, "Anna Novak");
  assert.equal(payload.suggestions[0]?.detail, "Klientka");
  assert.equal(payload.suggestions[1]?.label, "Kosmetické ošetření");
});

test("booking search route returns contact suggestions only for contact-like query", async () => {
  const { createAdminBookingSearchRouteApi } = await import("./route");
  const api = createAdminBookingSearchRouteApi({
    getSession: async () => ({
      sub: "admin-1",
      role: AdminRole.OWNER,
      email: "owner@example.com",
      name: "Owner",
      iat: 1,
      exp: 999999,
    }),
    isSameOriginAdminRequest: () => true,
    findClients: mockFindClients([
      {
        fullName: "Anna Novak",
        email: "anna@example.com",
        phone: "+420777123456",
      },
    ]),
    findServices: mockFindServices([]),
  });

  const response = await api.POST(createSearchRequest("777"));
  const payload = (await response.json()) as {
    status: string;
    suggestions: Array<{
      value: string;
      label: string;
      detail: string;
      kind: string;
    }>;
  };

  assert.equal(response.status, 200);
  assert.equal(payload.status, "success");
  assert.equal(payload.suggestions.length, 3);
  assert.equal(payload.suggestions[0]?.label, "Anna Novak");
  assert.equal(payload.suggestions[1]?.label, "anna@example.com");
  assert.equal(payload.suggestions[2]?.label, "+420 777 123 456");
});

test("booking search route returns empty list for too-short query", async () => {
  const { createAdminBookingSearchRouteApi } = await import("./route");
  const api = createAdminBookingSearchRouteApi({
    getSession: async () => ({
      sub: "admin-1",
      role: AdminRole.SALON,
      email: "salon@example.com",
      name: "Salon",
      iat: 1,
      exp: 999999,
    }),
    isSameOriginAdminRequest: () => true,
    findClients: mockFindClientsFailure("findClients should not run for invalid query"),
    findServices: mockFindServicesFailure("findServices should not run for invalid query"),
  });

  const response = await api.POST(createSearchRequest("a"));
  const payload = (await response.json()) as {
    status: string;
    suggestions: unknown[];
  };

  assert.equal(response.status, 200);
  assert.equal(payload.status, "success");
  assert.deepEqual(payload.suggestions, []);
});
