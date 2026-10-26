import assert from "node:assert/strict";
import test from "node:test";

import { onRequestError } from "../instrumentation";

const tokenizedPaths = [
  {
    path: "/rezervace/sprava/management-token",
    sanitizedPath: "/rezervace/sprava/[redacted]",
  },
  {
    path: "/rezervace/storno/cancellation-token",
    sanitizedPath: "/rezervace/storno/[redacted]",
  },
  {
    path: "/rezervace/akce/confirm/action-token",
    sanitizedPath: "/rezervace/akce/confirm/[redacted]",
  },
  {
    path: "/admin/pozvanka/invitation-token",
    sanitizedPath: "/admin/pozvanka/[redacted]",
  },
];

test("onRequestError redacts access tokens from request paths and referer headers", async () => {
  const originalConsoleError = console.error;
  const loggedArguments: unknown[][] = [];
  console.error = (...args: unknown[]) => loggedArguments.push(args);

  try {
    for (const { path, sanitizedPath } of tokenizedPaths) {
      await onRequestError(
        new Error("test error"),
        {
          method: "GET",
          path: `${path}?source=test`,
          headers: { referer: `https://example.com${path}?source=test` },
        } as Parameters<typeof onRequestError>[1],
        {} as Parameters<typeof onRequestError>[2],
      );

      const loggedEntry = loggedArguments.at(-1)?.[1];
      assert.equal(typeof loggedEntry, "string");

      const log = JSON.parse(loggedEntry as string) as {
        request: { path: string; headers: Record<string, string> };
      };

      assert.equal(log.request.path, sanitizedPath);
      assert.equal(log.request.headers.referer, `https://example.com${sanitizedPath}`);
      const token = path.slice(path.lastIndexOf("/") + 1);
      assert.ok(!JSON.stringify(log).includes(token));
    }
  } finally {
    console.error = originalConsoleError;
  }
});
