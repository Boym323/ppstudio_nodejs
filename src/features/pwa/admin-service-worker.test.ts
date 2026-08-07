import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

type FetchEventListener = (event: {
  request: Request;
  respondWith: (response: Promise<Response>) => void;
  waitUntil: (work: Promise<unknown>) => void;
}) => void;

async function loadWorker() {
  const source = await readFile(path.join(process.cwd(), "public/admin-sw.js"), "utf8");
  const listeners = new Map<string, FetchEventListener>();
  const cachePuts: Request[] = [];
  const cacheOpens: string[] = [];
  const context = {
    URL,
    Set,
    self: {
      location: { origin: "https://ppstudio.test" },
      addEventListener: (type: string, listener: FetchEventListener) => listeners.set(type, listener),
      skipWaiting: () => undefined,
      clients: { claim: async () => undefined },
    },
    caches: {
      match: async () => new Response("offline"),
      keys: async () => [],
      delete: async () => true,
      open: async (name: string) => {
        cacheOpens.push(name);
        return {
          put: async (request: Request) => {
            cachePuts.push(request);
          },
        };
      },
    },
    fetch: async () => new Response("network asset", { headers: { "Cache-Control": "public, max-age=31536000" } }),
  };

  vm.runInNewContext(source, context, { filename: "admin-sw.js" });
  const fetchListener = listeners.get("fetch");
  assert.ok(fetchListener, "worker musí registrovat fetch handler");

  return { cacheOpens, cachePuts, fetchListener };
}

async function dispatchFetch(fetchListener: FetchEventListener, request: Request) {
  let response: Promise<Response> | undefined;
  const work: Promise<unknown>[] = [];
  fetchListener({
    request,
    respondWith: (value) => {
      response = value;
    },
    waitUntil: (value) => work.push(value),
  });
  await response;
  await Promise.all(work);
  return response;
}

test("výsledný admin worker nikdy necachuje provozní data, API ani autentizované requesty", async () => {
  const cases = [
    new Request("https://ppstudio.test/admin/rezervace"),
    new Request("https://ppstudio.test/admin/klienti"),
    new Request("https://ppstudio.test/admin/vouchery"),
    new Request("https://ppstudio.test/api/admin/bookings"),
    new Request("https://ppstudio.test/_next/static/chunks/app.js", { headers: { Authorization: "Bearer session" } }),
    new Request("https://ppstudio.test/admin/rezervace?_rsc=private", { headers: { RSC: "1" } }),
  ];

  for (const request of cases) {
    const worker = await loadWorker();
    await dispatchFetch(worker.fetchListener, request);
    assert.deepEqual(worker.cacheOpens, [], `${new URL(request.url).pathname} nesmí otevřít cache`);
    assert.deepEqual(worker.cachePuts, [], `${new URL(request.url).pathname} nesmí zapsat cache`);
  }
});

test("výsledný admin worker cacheuje pouze admin ikony a neměnné Next assety", async () => {
  for (const pathname of ["/pwa/admin-192.png", "/_next/static/chunks/app.js"]) {
    const worker = await loadWorker();
    const response = await dispatchFetch(worker.fetchListener, new Request(`https://ppstudio.test${pathname}`));
    assert.equal(await response?.text(), "network asset");
    assert.deepEqual(worker.cacheOpens, ["ppstudio-admin-shell-v4"]);
    assert.equal(worker.cachePuts.length, 1);
  }
});

test("offline fallback je dostupný jen pro admin navigaci", async () => {
  const worker = await loadWorker();
  const response = await dispatchFetch(worker.fetchListener, new Request("https://ppstudio.test/admin/rezervace", { mode: "navigate" }));
  assert.equal(await response?.text(), "network asset");
  assert.deepEqual(worker.cachePuts, []);

  const publicWorker = await loadWorker();
  const publicResponse = await dispatchFetch(publicWorker.fetchListener, new Request("https://ppstudio.test/rezervace", { mode: "navigate" }));
  assert.equal(publicResponse, undefined);
  assert.deepEqual(publicWorker.cacheOpens, []);
});
