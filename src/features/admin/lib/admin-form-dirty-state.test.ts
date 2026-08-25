import assert from "node:assert/strict";
import test from "node:test";

import {
  canCloseAdminDetail,
  isFormDirty,
  resolveSavedFormSnapshot,
  serializeFormEntries,
} from "./admin-form-dirty-state";

function snapshot(entries: Array<[string, string]>) {
  return serializeFormEntries(entries);
}

test("změna pole označí formulář jako dirty", () => {
  assert.equal(isFormDirty(snapshot([["name", "Původní"]]), snapshot([["name", "Nový"]])), true);
});

test("úspěšný save je clean po nastavení nového výchozího snapshotu", () => {
  const initialSnapshot = snapshot([["name", "Původní"]]);
  const savedSnapshot = snapshot([["name", "Nový"]]);
  const nextInitialSnapshot = resolveSavedFormSnapshot(initialSnapshot, savedSnapshot, "success");

  assert.equal(isFormDirty(nextInitialSnapshot, savedSnapshot), false);
});

test("zavření dirty detailu vyžádá potvrzení", () => {
  let confirmationCount = 0;
  const canClose = canCloseAdminDetail(true, () => {
    confirmationCount += 1;
    return false;
  });

  assert.equal(canClose, false);
  assert.equal(confirmationCount, 1);
});

test("zavření clean detailu proběhne bez potvrzení", () => {
  let confirmationCount = 0;
  const canClose = canCloseAdminDetail(false, () => {
    confirmationCount += 1;
    return false;
  });

  assert.equal(canClose, true);
  assert.equal(confirmationCount, 0);
});

test("failed save zachová změněný snapshot jako dirty", () => {
  const initialSnapshot = snapshot([["name", "Původní"]]);
  const failedSubmissionSnapshot = snapshot([["name", "Neplatná změna"]]);
  const nextInitialSnapshot = resolveSavedFormSnapshot(initialSnapshot, failedSubmissionSnapshot, "error");

  assert.equal(isFormDirty(nextInitialSnapshot, failedSubmissionSnapshot), true);
});
