import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const serverOnlyStubPath = path.join(currentDir, "server-only-stub.cjs");
const originalResolveFilename = Module._resolveFilename.bind(Module);

// Test commands mohou běžet na serveru s produkčním .env. Tento hook se načítá
// před aplikačními moduly, proto musí zděděnou produkční konfiguraci přepsat,
// nikoli jen doplnit chybějící hodnotu.
process.env.PUSHOVER_ENABLED = "false";

Module._resolveFilename = (request, parent, isMain, options) => {
  if (request === "server-only") {
    return serverOnlyStubPath;
  }

  return originalResolveFilename(request, parent, isMain, options);
};
