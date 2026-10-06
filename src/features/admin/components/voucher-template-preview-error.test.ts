import assert from "node:assert/strict";
import test from "node:test";

import { readVoucherTemplatePreviewError } from "./voucher-template-preview-error";

test("overflow zachová bezpečný název oblasti a poradí opravu bez HTTP či stacku", async () => {
  for (const label of ["Hodnota", "Služba", "Platnost", "Kód"]) {
    const error = await readVoucherTemplatePreviewError(Response.json({ code: "text_overflow", message: `Dynamický text se nevejde do oblasti „${label}“ ani při minimální velikosti písma.`, stack: "private stack" }, { status: 422 }));
    assert.deepEqual(error, { code: "text_overflow", message: `${label} se nevejde do vybrané oblasti. Zvětšete oblast nebo snižte minimální velikost písma.` });
  }
  const unknown = await readVoucherTemplatePreviewError(Response.json({ code: "text_overflow", message: "Unknown internal label /private/path" }, { status: 422 }));
  assert.equal(unknown.message, "Text se nevejde do vybrané oblasti. Zvětšete oblast nebo snižte minimální velikost písma.");
});

test("ostatní bezpečné odpovědi fungují jako text i JSON, poškozený JSON má fallback", async () => {
  assert.deepEqual(await readVoucherTemplatePreviewError(new Response("Nemáte oprávnění.", { status: 403 })), { code: null, message: "Nemáte oprávnění." });
  assert.deepEqual(await readVoucherTemplatePreviewError(Response.json({ code: "invalid_print_pdf", message: "PDF neprošlo kontrolou." }, { status: 422 })), { code: "invalid_print_pdf", message: "PDF neprošlo kontrolou." });
  for (const text of ["not json", "null", "{}", "[]"]) {
    const error = await readVoucherTemplatePreviewError(new Response(text, { headers: { "content-type": "application/json" } }));
    assert.equal(error.code, null);
    assert.match(error.message, /Náhled se nepodařilo aktualizovat/);
  }
});
