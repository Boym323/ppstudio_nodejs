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

type InstallEventListener = (event: {
  waitUntil: (work: Promise<unknown>) => void;
}) => void;

async function loadWorker() {
  const source = await readFile(path.join(process.cwd(), "public/admin-sw.js"), "utf8");
  const listeners = new Map<string, FetchEventListener | InstallEventListener>();
  const cacheAdds: string[][] = [];
  const cachePuts: Request[] = [];
  const cacheOpens: string[] = [];
  const context = {
    URL,
    Set,
    self: {
      location: { origin: "https://ppstudio.test" },
      addEventListener: (type: string, listener: FetchEventListener | InstallEventListener) => listeners.set(type, listener),
      skipWaiting: () => undefined,
      clients: { claim: async () => undefined },
    },
    caches: {
      match: async (request: Request | string) => typeof request === "string" ? new Response("offline") : undefined,
      keys: async () => [],
      delete: async () => true,
      open: async (name: string) => {
        cacheOpens.push(name);
        return {
          addAll: async (requests: string[]) => {
            cacheAdds.push(requests);
          },
          put: async (request: Request) => {
            cachePuts.push(request);
          },
        };
      },
    },
    fetch: async () => new Response("network asset", { headers: { "Cache-Control": "public, max-age=31536000" } }),
  };

  vm.runInNewContext(source, context, { filename: "admin-sw.js" });
  const fetchListener = listeners.get("fetch") as FetchEventListener | undefined;
  const installListener = listeners.get("install") as InstallEventListener | undefined;
  assert.ok(fetchListener, "worker musí registrovat fetch handler");
  assert.ok(installListener, "worker musí registrovat install handler");

  return { cacheAdds, cacheOpens, cachePuts, fetchListener, installListener };
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

async function dispatchInstall(installListener: InstallEventListener) {
  const work: Promise<unknown>[] = [];
  installListener({ waitUntil: (value) => work.push(value) });
  await Promise.all(work);
}

test("výsledný admin worker do instalační cache uloží jen explicitní offline shell", async () => {
  const worker = await loadWorker();
  await dispatchInstall(worker.installListener);
  assert.deepEqual(worker.cacheAdds.map((requests) => Array.from(requests)), [["/admin-offline.html", "/pwa/admin-192.png", "/pwa/admin-512.png", "/pwa/admin-maskable-512.png"]]);
});

test("výsledný admin worker nikdy necachuje nic mimo explicitní allowlist", async () => {
  const cases = [
    { url: "https://ppstudio.test/admin/", method: "GET", mode: "navigate", headers: new Headers() } as Request,
    new Request("https://ppstudio.test/admin/rezervace"),
    new Request("https://ppstudio.test/admin/klienti"),
    new Request("https://ppstudio.test/admin/vouchery"),
    new Request("https://ppstudio.test/api/admin/bookings"),
    new Request("https://ppstudio.test/jiny-zdroj"),
    new Request("https://example.test/_next/static/chunks/app.js"),
    new Request("https://ppstudio.test/_next/static/chunks/app.js", { headers: { Authorization: "Bearer session" } }),
    new Request("https://ppstudio.test/admin/rezervace?_rsc=private", { headers: { RSC: "1" } }),
    new Request("https://ppstudio.test/_next/static/chunks/app.js", { headers: { RSC: "1" } }),
    new Request("https://ppstudio.test/_next/static/chunks/app.js", { method: "POST" }),
    new Request("https://ppstudio.test/_next/static/chunks/app.js", { method: "PUT" }),
    new Request("https://ppstudio.test/_next/static/chunks/app.js", { method: "PATCH" }),
    new Request("https://ppstudio.test/_next/static/chunks/app.js", { method: "DELETE" }),
  ];

  for (const request of cases) {
    const worker = await loadWorker();
    await dispatchFetch(worker.fetchListener, request);
    assert.deepEqual(worker.cacheOpens, [], `${new URL(request.url).pathname} nesmí otevřít cache`);
    assert.deepEqual(worker.cachePuts, [], `${new URL(request.url).pathname} nesmí zapsat cache`);
  }
});

test("výsledný admin worker cacheuje pouze explicitně povolené PWA ikony a neměnné Next assety", async () => {
  for (const pathname of ["/pwa/admin-192.png", "/pwa/admin-512.png", "/pwa/admin-maskable-512.png", "/_next/static/chunks/app.js"]) {
    const worker = await loadWorker();
    const response = await dispatchFetch(worker.fetchListener, new Request(`https://ppstudio.test${pathname}`));
    assert.equal(await response?.text(), "network asset");
    assert.deepEqual(worker.cacheOpens, ["ppstudio-admin-shell-v4"]);
    assert.equal(worker.cachePuts.length, 1);
  }
});

test("offline fallback je dostupný jen pro admin navigaci", async () => {
  const worker = await loadWorker();
  const response = await dispatchFetch(worker.fetchListener, { url: "https://ppstudio.test/admin/rezervace", method: "GET", mode: "navigate", headers: new Headers() } as Request);
  assert.equal(await response?.text(), "network asset");
  assert.deepEqual(worker.cachePuts, []);

  const publicWorker = await loadWorker();
  const publicResponse = await dispatchFetch(publicWorker.fetchListener, { url: "https://ppstudio.test/rezervace", method: "GET", mode: "navigate", headers: new Headers() } as Request);
  assert.equal(publicResponse, undefined);
  assert.deepEqual(publicWorker.cacheOpens, []);
});
