import assert from "node:assert/strict";
import test from "node:test";

import { cachePwaResponseSafely } from "./admin-pwa-response-cache";

const request = new Request("https://ppstudio.test/_next/static/chunks/app.js");

test("bezpečná PWA cache ukládá klon a původní odpověď zůstane čitelná", async () => {
  let cachedResponse: Response | undefined;
  const networkResponse = new Response("bezpečný asset", { status: 200 });

  await cachePwaResponseSafely({
    put: async (_request, response) => {
      cachedResponse = response;
    },
  }, request, networkResponse);

  assert.ok(cachedResponse);
  assert.equal(await cachedResponse.text(), "bezpečný asset");
  assert.equal(await networkResponse.text(), "bezpečný asset");
});

test("spotřebovaná odpověď se neklonuje ani neukládá", async () => {
  const networkResponse = new Response("už přečteno", { status: 200 });
  await networkResponse.text();
  let putCalls = 0;

  await cachePwaResponseSafely({
    put: async () => {
      putCalls += 1;
    },
  }, request, networkResponse);

  assert.equal(putCalls, 0);
});

test("selhání cache.put nebrání vrácení čitelné síťové odpovědi", async () => {
  const networkResponse = new Response("síť zůstává dostupná", { status: 200 });

  await cachePwaResponseSafely({
    put: async () => {
      throw new Error("Cache Storage není dostupná");
    },
  }, request, networkResponse);

  assert.equal(await networkResponse.text(), "síť zůstává dostupná");
});
