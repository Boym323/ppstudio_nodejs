import "dotenv/config";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

import {
  SERVICE_CATALOG_CUTOVER_ID,
  applyServiceCatalogCutover,
  previewServiceCatalogCutover,
  type ServiceCatalogCutoverPlan,
} from "@/features/admin/lib/service-catalog-cutover";

const valuesSchema = z.object({ name: z.string().trim().min(1), publicName: z.string().trim().min(1).nullable(), priceFromCzk: z.number().int().nonnegative().nullable(), durationMinutes: z.number().int().positive() });
const planSchema = z.object({
  cutoverId: z.literal(SERVICE_CATALOG_CUTOVER_ID),
  actorUserId: z.string().trim().min(1),
  changes: z.array(z.object({ serviceId: z.string().trim().min(1), expected: valuesSchema, target: valuesSchema })).min(1),
});

function parseArgs(argv: string[]) {
  return { file: argv.at(argv.indexOf("--file") + 1) ?? null, execute: argv.includes("--execute"), confirm: argv.includes(`--confirm=${SERVICE_CATALOG_CUTOVER_ID}`) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) throw new Error("Použití: tsx scripts/service-catalog-cutover-2026-10-01.ts --file <plan.json> [--execute --confirm=service-catalog-cutover-2026-10-01]");
  if (args.execute && !args.confirm) throw new Error("Zápis vyžaduje přesné --confirm=service-catalog-cutover-2026-10-01.");
  if (args.execute && process.env.NODE_ENV === "production" && process.env.PPSTUDIO_ALLOW_SERVICE_CATALOG_CUTOVER_PROD !== "1") {
    throw new Error("Produkční zápis je blokován. Po schváleném dry-runu nastavte pro jediný proces PPSTUDIO_ALLOW_SERVICE_CATALOG_CUTOVER_PROD=1.");
  }
  const plan = planSchema.parse(JSON.parse(await readFile(resolve(process.cwd(), args.file), "utf8"))) as ServiceCatalogCutoverPlan;
  const result = args.execute ? await applyServiceCatalogCutover(plan) : await previewServiceCatalogCutover(plan);
  console.log(JSON.stringify({ mode: args.execute ? "execute" : "dry-run", cutoverId: SERVICE_CATALOG_CUTOVER_ID, result }, null, 2));
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
