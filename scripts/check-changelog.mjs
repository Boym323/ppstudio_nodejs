#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const VERSION_HEADING = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})$/;
const CATEGORY_HEADING = /^### .+$/;

function fail(message) {
  throw new Error(message);
}

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    const detail = error.stderr?.toString().trim();
    fail(detail || `Příkaz git ${args.join(" ")} selhal.`);
  }
}

export function validateStructure(changelog) {
  const lines = changelog.replace(/\r\n/g, "\n").split("\n");
  const h2 = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.startsWith("## "));
  const unreleased = h2.filter(({ line }) => line === "## [Unreleased]");

  if (unreleased.length !== 1) {
    fail(`CHANGELOG.md musí obsahovat právě jednu sekci \"## [Unreleased]\"; nalezeno: ${unreleased.length}.`);
  }
  if (h2[0]?.line !== "## [Unreleased]") {
    fail("Sekce ## [Unreleased] musí být před všemi verzovanými sekcemi.");
  }

  for (const heading of h2.slice(1)) {
    if (!VERSION_HEADING.test(heading.line)) {
      fail(`Verzovaná sekce má neplatný formát: \"${heading.line}\". Očekává se ## [X.Y.Z] - RRRR-MM-DD.`);
    }
  }

  const unreleasedEnd = h2[1]?.index ?? lines.length;
  const unreleasedLines = lines.slice(unreleased[0].index + 1, unreleasedEnd);
  const categories = unreleasedLines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => CATEGORY_HEADING.test(line));

  for (const category of categories) {
    const end = categories.find((next) => next.index > category.index)?.index ?? unreleasedLines.length;
    if (!unreleasedLines.slice(category.index + 1, end).some((line) => /^\s*[-*+]\s+\S/.test(line))) {
      fail(`Kategorie \"${category.line}\" v Unreleased nesmí být prázdná.`);
    }
  }

  const linkDefinitions = lines.filter((line) => /^\[[^\]]+\]:\s+\S+/.test(line));
  const versionLinks = linkDefinitions.filter((line) => /^\[\d+\.\d+\.\d+\]:\s+\S+/.test(line));
  if (linkDefinitions.length > 0 && versionLinks.length > 0 && versionLinks.length !== linkDefinitions.length) {
    fail("Odkazy na verze v CHANGELOG.md musí používat jednotný formát [X.Y.Z]: URL.");
  }
}

function isTestPath(path) {
  return /(^|\/)(tests?|__tests__|test-results)\//.test(path) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) || /\.(snap)$/.test(path);
}

export function isProductionPath(path) {
  if (isTestPath(path)) return false;
  return (
    path.startsWith("src/") ||
    path === "prisma/schema.prisma" ||
    /^prisma\/migrations\/[^/]+\/migration\.sql$/.test(path) ||
    path.startsWith("deploy/") ||
    path === "next.config.ts" ||
    path === "instrumentation.ts" ||
    path === "middleware.ts" ||
    path === "package.json" ||
    path === "package-lock.json"
  );
}

function parseArguments(argv) {
  const args = { base: undefined, skipReason: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--base") args.base = argv[++index];
    else if (argv[index] === "--skip-reason") args.skipReason = argv[++index];
    else fail(`Neznámý argument: ${argv[index]}. Použij --base <commit-nebo-větev> a volitelně --skip-reason <důvod>.`);
  }
  return args;
}

export function run(argv = process.argv.slice(2)) {
  const changelogPath = resolve("CHANGELOG.md");
  if (!existsSync(changelogPath)) fail("Soubor CHANGELOG.md neexistuje.");
  validateStructure(readFileSync(changelogPath, "utf8"));

  const { base, skipReason } = parseArguments(argv);
  if (!base) {
    console.log("Struktura CHANGELOG.md je v pořádku.");
    return;
  }

  try {
    git(["rev-parse", "--verify", `${base}^{commit}`]);
  } catch (error) {
    fail(`Neplatný základ pro porovnání \"${base}\". Zkontroluj dostupnost commitu nebo větve (např. origin/main).`);
  }

  const changedFiles = [...new Set([
    ...git(["diff", "--name-only", "--diff-filter=ACMRD", base]).split("\n"),
    ...git(["ls-files", "--others", "--exclude-standard"]).split("\n"),
  ])].filter(Boolean);
  const productionFiles = changedFiles.filter(isProductionPath);
  const hasChangelog = changedFiles.includes("CHANGELOG.md");

  if (productionFiles.length === 0 || hasChangelog) {
    console.log("Kontrola changelogu prošla.");
    return;
  }
  const exceptionReason = skipReason?.match(/^\s*Důvod pro skip-changelog:\s*(?!<)(.+\S)\s*$/im)?.[1];
  if (exceptionReason) {
    console.warn(`Kontrola changelogu je přeskočena s uvedeným důvodem: ${exceptionReason}`);
    return;
  }

  fail(`Změněné produkční soubory (${productionFiles.join(", ")}) vyžadují uživatelsky srozumitelný záznam v CHANGELOG.md / Unreleased. Pokud jde prokazatelně o změnu bez dopadu na chování, použij v PR label skip-changelog a do popisu napiš „Důvod pro skip-changelog: <konkrétní důvod>“.`);
}

try {
  run();
} catch (error) {
  console.error(`Changelog check: ${error.message}`);
  process.exitCode = 1;
}
