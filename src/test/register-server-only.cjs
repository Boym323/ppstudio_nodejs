const Module = require("node:module");
const path = require("node:path");

const serverOnlyStubPath = path.join(__dirname, "server-only-stub.cjs");
const originalResolveFilename = Module._resolveFilename.bind(Module);

Module._resolveFilename = (request, parent, isMain, options) => {
  if (request === "server-only") {
    return serverOnlyStubPath;
  }

  return originalResolveFilename(request, parent, isMain, options);
};
