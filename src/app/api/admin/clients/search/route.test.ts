import assert from "node:assert/strict";
import test from "node:test";
import { AdminRole } from "@/generated/prisma/browser";

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

function createSearchRequest(body: string, contentType = "application/json") {
  return new Request("https://example.com/api/admin/clients/search", {
    method: "POST",
    headers: { "Content-Type": contentType },
    body,
  });
}

function createAdminSession(role: AdminRole = AdminRole.OWNER) {
  return {
    sub: "admin-1",
    role,
    email: "owner@example.com",
    name: "Owner",
    iat: 1,
    exp: 999999,
  };
}

function failingFindClients(message: string) {
  return (async () => {
    throw new Error(message);
  }) as typeof prisma.client.findMany;
}

test("client search odmítne nepřihlášený požadavek", async () => {
  const { createAdminClientSearchRouteApi } = await import("./admin-client-search-route-api");
  const api = createAdminClientSearchRouteApi({
    getSession: async () => null,
    isSameOriginAdminRequest: () => true,
    findClients: failingFindClients("findClients should not run without session"),
  });

  const response = await api.POST(createSearchRequest('{"query":"Anna"}'));

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("client search odmítne nepovolenou roli", async () => {
  const { createAdminClientSearchRouteApi } = await import("./admin-client-search-route-api");
  const api = createAdminClientSearchRouteApi({
    getSession: async () => createAdminSession("UNAUTHORIZED" as AdminRole),
    isSameOriginAdminRequest: () => true,
    findClients: failingFindClients("findClients should not run for an unauthorized role"),
  });

  const response = await api.POST(createSearchRequest('{"query":"Anna"}'));

  assert.equal(response.status, 403);
});

test("client search vrátí stejné výsledky pro platný POST", async () => {
  const { createAdminClientSearchRouteApi } = await import("./admin-client-search-route-api");
  const api = createAdminClientSearchRouteApi({
    getSession: async () => createAdminSession(),
    isSameOriginAdminRequest: () => true,
    findClients: (async () => {
      return [{
        id: "client-1",
        fullName: "Anna Nováková",
        email: null,
        phone: "+420777123456",
        internalNote: "Pravidelná klientka",
        isActive: true,
      }];
    }) as typeof prisma.client.findMany,
  });

  const response = await api.POST(createSearchRequest('{"query":" Anna "}'));
  const payload = (await response.json()) as {
    status: string;
    clients: Array<{ fullName: string; email: string }>;
  };

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(payload.status, "success");
  assert.equal(payload.clients[0]?.fullName, "Anna Nováková");
  assert.equal(payload.clients[0]?.email, "");
});

test("client search vrátí prázdný seznam pro neplatný nebo krátký dotaz", async () => {
  const { createAdminClientSearchRouteApi } = await import("./admin-client-search-route-api");
  const api = createAdminClientSearchRouteApi({
    getSession: async () => createAdminSession(),
    isSameOriginAdminRequest: () => true,
    findClients: failingFindClients("findClients should not run for invalid query"),
  });

  for (const body of ['{"query":"a"}', '{"query":123}']) {
    const response = await api.POST(createSearchRequest(body));
    const payload = (await response.json()) as { status: string; clients: unknown[] };

    assert.equal(response.status, 200);
    assert.equal(payload.status, "success");
    assert.deepEqual(payload.clients, []);
  }
});

test("client search vrátí prázdný seznam pro chybné JSON", async () => {
  const { createAdminClientSearchRouteApi } = await import("./admin-client-search-route-api");
  const api = createAdminClientSearchRouteApi({
    getSession: async () => createAdminSession(),
    isSameOriginAdminRequest: () => true,
    findClients: failingFindClients("findClients should not run for malformed JSON"),
  });

  const response = await api.POST(createSearchRequest('{"query":'));
  const payload = (await response.json()) as { status: string; clients: unknown[] };

  assert.equal(response.status, 200);
  assert.equal(payload.status, "success");
  assert.deepEqual(payload.clients, []);
});

test("client search odmítne cizí origin před ověřením session a databází", async () => {
  const { createAdminClientSearchRouteApi } = await import("./admin-client-search-route-api");
  const api = createAdminClientSearchRouteApi({
    getSession: async () => {
      throw new Error("getSession should not run for an unsafe origin");
    },
    isSameOriginAdminRequest: () => false,
    findClients: failingFindClients("findClients should not run for an unsafe origin"),
  });

  const response = await api.POST(createSearchRequest('{"query":"Anna"}'));

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("client search vyžaduje application/json", async () => {
  const { createAdminClientSearchRouteApi } = await import("./admin-client-search-route-api");
  const api = createAdminClientSearchRouteApi({
    getSession: async () => createAdminSession(),
    isSameOriginAdminRequest: () => true,
    findClients: failingFindClients("findClients should not run without JSON content type"),
  });

  const response = await api.POST(createSearchRequest('{"query":"Anna"}', "text/plain"));

  assert.equal(response.status, 415);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("client search GET vrací 405 bez vyhledávání", async () => {
  const route = await import("./route");

  const response = route.GET();

  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});
