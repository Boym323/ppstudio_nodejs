import assert from "node:assert/strict";
import test from "node:test";

import { AdminRole } from "@/generated/prisma/browser";

import { createProtectedHealthDiagnosticsRoute } from "./route-api";

function createSession(role: AdminRole) {
  return {
    sub: "admin-1",
    email: "admin@example.com",
    name: "Admin",
    role,
  };
}

test("detailní health diagnostika bez admin session odmítne přístup před DB prací", async () => {
  let diagnosticsCalls = 0;
  const api = createProtectedHealthDiagnosticsRoute({
    getSession: async () => null,
    getDiagnostics: async () => {
      diagnosticsCalls += 1;
      return Response.json({ status: "ok" });
    },
  });

  const response = await api.GET();

  assert.equal(response.status, 401);
  assert.equal(diagnosticsCalls, 0);
});

test("detailní health diagnostika je dostupná pouze ownerovi", async () => {
  const forbiddenApi = createProtectedHealthDiagnosticsRoute({
    getSession: async () => createSession(AdminRole.SALON),
    getDiagnostics: async () => Response.json({ status: "ok" }),
  });
  const ownerApi = createProtectedHealthDiagnosticsRoute({
    getSession: async () => createSession(AdminRole.OWNER),
    getDiagnostics: async () => Response.json({ status: "ok", emailQueue: {} }),
  });

  assert.equal((await forbiddenApi.GET()).status, 403);
  const ownerResponse = await ownerApi.GET();
  assert.equal(ownerResponse.status, 200);
  assert.deepEqual(await ownerResponse.json(), { status: "ok", emailQueue: {} });
});
