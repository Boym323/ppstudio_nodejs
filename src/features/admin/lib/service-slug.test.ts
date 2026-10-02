import assert from "node:assert/strict";
import test from "node:test";

import { isValidServiceSlug, normalizeServiceSlugInput } from "./service-slug-validation";

test("veřejný slug přijímá pouze kanonický lowercase tvar", () => {
  assert.equal(isValidServiceSlug("signature-skin-ritual"), true);
  assert.equal(isValidServiceSlug("Signature Skin Ritual"), false);
  assert.equal(isValidServiceSlug("-skin-ritual"), false);
  assert.equal(isValidServiceSlug("skin--ritual"), false);
  assert.equal(isValidServiceSlug("skin_ritual"), false);
  assert.equal(isValidServiceSlug(""), false);
});

test("normalizace slugu nabízí bezpečný kandidát pro UI", () => {
  assert.equal(normalizeServiceSlugInput(" Signature Skin Ritual "), "signature-skin-ritual");
  assert.equal(normalizeServiceSlugInput("Řasy / obočí"), "rasy-oboci");
});
