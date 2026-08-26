import assert from "node:assert/strict";
import test from "node:test";

import { MediaCollectionType } from "@/generated/prisma/browser";

test("MediaCollectionType obsahuje pouze plánované kolekce expand fáze", () => {
  assert.deepEqual(Object.values(MediaCollectionType), [
    "CERTIFICATES",
    "STUDIO_GALLERY",
    "REFERENCES",
  ]);
});
