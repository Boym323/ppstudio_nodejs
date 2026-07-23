import assert from "node:assert/strict";
import test from "node:test";

import { clientListSearchParamsSchema, clientListViewValues, normalizeClientListPage } from "./admin-client-validation";

test("normalizeClientListPage normalizuje číslo stránky", () => {
  assert.equal(normalizeClientListPage(undefined), 1);
  assert.equal(normalizeClientListPage("1"), 1);
  assert.equal(normalizeClientListPage("2"), 2);
  assert.equal(normalizeClientListPage("0"), 1);
  assert.equal(normalizeClientListPage("-1"), 1);
  assert.equal(normalizeClientListPage("druhá"), 1);
});

test("validace přijímá všechny CRM pohledy a odmítne neplatný", () => {
  for (const view of clientListViewValues) {
    assert.equal(clientListSearchParamsSchema.safeParse({ view }).success, true);
  }
  assert.equal(clientListSearchParamsSchema.safeParse({ view: "archiv" }).success, false);
});
