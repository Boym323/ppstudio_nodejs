#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CURRENT_VERSION_MARKER = "<!-- current-version -->";
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const currentVersionDocuments = ["README.md"];

function readJson(path) {
  try {
    return JSON.parse(readFileSync(resolve(path), "utf8"));
  } catch (error) {
    throw new Error(`Soubor ${path} nelze načíst: ${error.message}`);
  }
}

function fail(message) {
  throw new Error(message);
}

function checkDocumentVersion(path, version) {
  let content;
  try {
    content = readFileSync(resolve(path), "utf8");
  } catch (error) {
    fail(`Soubor ${path} nelze načíst: ${error.message}`);
  }

  const markerIndex = content.indexOf(CURRENT_VERSION_MARKER);
  if (markerIndex === -1) {
    fail(`${path} musí označit aktuální verzi značkou ${CURRENT_VERSION_MARKER}.`);
  }

  const afterMarker = content.slice(markerIndex + CURRENT_VERSION_MARKER.length);
  const displayedVersion = afterMarker.match(/^\*\*(\d+\.\d+\.\d+)\*\*/)?.[1];
  if (!displayedVersion) {
    fail(`${path} musí bezprostředně za značkou aktuální verze uvádět formát **X.Y.Z**.`);
  }
  if (displayedVersion !== version) {
    fail(`${path} uvádí aktuální verzi ${displayedVersion}, ale package.json má ${version}.`);
  }
}

const packageJson = readJson("package.json");
const lockfile = readJson("package-lock.json");
const version = packageJson.version;

if (typeof version !== "string" || !VERSION_PATTERN.test(version)) {
  fail(`package.json obsahuje neplatnou SemVer verzi: ${String(version)}.`);
}
if (lockfile.version !== version || lockfile.packages?.[""]?.version !== version) {
  fail(`package-lock.json musí mít kořenovou verzi ${version}.`);
}

for (const path of currentVersionDocuments) checkDocumentVersion(path, version);

console.log(`Kontrola konzistence verze ${version} prošla.`);
