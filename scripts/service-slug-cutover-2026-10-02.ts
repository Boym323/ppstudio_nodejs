import "dotenv/config";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

import {
  SERVICE_SLUG_CUTOVER_ID,
  applyServiceSlugCutover,
  previewServiceSlugCutover,
  type ServiceSlugCutoverPlan,
} from "@/features/admin/lib/service-slug-cutover";

const slugSchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const planSchema = z.object({
  cutoverId: z.literal(SERVICE_SLUG_CUTOVER_ID),
  actorUserId: z.string().trim().min(1),
  changes: z.array(z.object({
    serviceId: z.string().trim().min(1),
    expectedSlug: slugSchema,
    targetSlug: slugSchema,
  })).min(1),
});

function parseArgs(argv: string[]) {
  return {
    file: argv.at(argv.indexOf("--file") + 1) ?? null,
    execute: argv.includes("--execute"),
    confirm: argv.includes(`--confirm=${SERVICE_SLUG_CUTOVER_ID}`),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) throw new Error("Použití: tsx scripts/service-slug-cutover-2026-10-02.ts --file <plan.json> [--execute --confirm=service-slug-cutover-2026-10-02]");
  if (args.execute && !args.confirm) throw new Error("Zápis vyžaduje přesné --confirm=service-slug-cutover-2026-10-02.");
  if (args.execute && process.env.NODE_ENV === "production" && process.env.PPSTUDIO_ALLOW_SERVICE_SLUG_CUTOVER_PROD !== "1") {
    throw new Error("Produkční zápis je blokován. Po schváleném dry-runu nastavte pro jediný proces PPSTUDIO_ALLOW_SERVICE_SLUG_CUTOVER_PROD=1.");
  }

  const plan = planSchema.parse(JSON.parse(await readFile(resolve(process.cwd(), args.file), "utf8"))) as ServiceSlugCutoverPlan;
  const result = args.execute ? await applyServiceSlugCutover(plan) : await previewServiceSlugCutover(plan);
  console.log(JSON.stringify({ mode: args.execute ? "execute" : "dry-run", cutoverId: SERVICE_SLUG_CUTOVER_ID, result }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
