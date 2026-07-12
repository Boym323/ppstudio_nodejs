import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldTrackContactFieldError,
  shouldTrackContactFieldInput,
  shouldTrackFirstContactFieldEvent,
} from "./contact-analytics";
import { getContactFieldErrorReason } from "./helpers";
import type { ContactFieldKey } from "./types";

test("shouldTrackFirstContactFieldEvent tracks each field only once", () => {
  const tracked = new Set<ContactFieldKey>();

  assert.equal(shouldTrackFirstContactFieldEvent(tracked, "email"), true);
  assert.equal(shouldTrackFirstContactFieldEvent(tracked, "email"), false);
  assert.equal(shouldTrackFirstContactFieldEvent(tracked, "phone"), true);
});

test("shouldTrackContactFieldInput skips empty values and duplicate tracked field", () => {
  const tracked = new Set<ContactFieldKey>();

  assert.equal(shouldTrackContactFieldInput(tracked, "fullName", "   "), false);
  assert.equal(shouldTrackContactFieldInput(tracked, "fullName", "Jana"), true);
  assert.equal(shouldTrackContactFieldInput(tracked, "fullName", "Jana N."), false);
});

test("shouldTrackContactFieldError tracks only when field has error and only once", () => {
  const tracked = new Set<ContactFieldKey>();

  assert.equal(shouldTrackContactFieldError(tracked, "phone", false), false);
  assert.equal(shouldTrackContactFieldError(tracked, "phone", true), true);
  assert.equal(shouldTrackContactFieldError(tracked, "phone", true), false);
});

test("getContactFieldErrorReason returns stable, non-personal validation reasons", () => {
  assert.equal(getContactFieldErrorReason("fullName", ""), "povinné");
  assert.equal(getContactFieldErrorReason("fullName", "A"), "příliš krátké");
  assert.equal(getContactFieldErrorReason("fullName", "123"), "neplatný formát");
  assert.equal(getContactFieldErrorReason("fullName", "Jana Nováková"), undefined);
  assert.equal(getContactFieldErrorReason("email", "jana@"), "neplatný formát");
  assert.equal(getContactFieldErrorReason("phone", ""), undefined);
});
