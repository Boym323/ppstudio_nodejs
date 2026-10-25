import assert from "node:assert/strict";
import test from "node:test";
import { assertDevBootstrapAllowed } from "./dev-bootstrap";

const allowed = { NODE_ENV: "development", PPSTUDIO_DEV_BOOTSTRAP: "1", DATABASE_URL: "postgresql://dev@192.168.1.55/ppstudio_dev" };
test("DEV bootstrap vyžaduje explicitní opt-in, DEV runtime a privátní DEV databázi", () => {
  assert.doesNotThrow(() => assertDevBootstrapAllowed(allowed));
  for (const override of [
    { NODE_ENV: "production" }, { NODE_ENV: "test" }, { PPSTUDIO_DEV_BOOTSTRAP: "0" },
    { DATABASE_URL: "postgresql://dev@192.168.1.55/ppstudio" },
    { DATABASE_URL: "postgresql://dev@db.example.com/ppstudio_dev" },
    { DATABASE_URL: "postgresql://dev@localhost/ppstudio_prod" },
  ]) assert.throws(() => assertDevBootstrapAllowed({ ...allowed, ...override }));
});
