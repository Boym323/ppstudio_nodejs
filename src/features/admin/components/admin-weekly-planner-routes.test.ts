import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../../../../", import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, projectRoot), "utf8");
}

test("hlavní routy OWNER a SALON používají stejný produkční planner", async () => {
  const [ownerRoute, salonRoute, plannerPage] = await Promise.all([
    source("src/app/(admin)/admin/volne-terminy/page.tsx"),
    source("src/app/(admin)/admin/provoz/volne-terminy/page.tsx"),
    source("src/features/admin/components/admin-weekly-planner-lab-page.tsx"),
  ]);

  assert.match(ownerRoute, /requireAdminSectionAccess\("owner", "volne-terminy"\)/);
  assert.match(salonRoute, /requireAdminSectionAccess\("salon", "volne-terminy"\)/);
  assert.match(ownerRoute, /<AdminWeeklyPlannerPage area="owner"/);
  assert.match(salonRoute, /<AdminWeeklyPlannerPage area="salon"/);
  assert.match(plannerPage, /export async function AdminWeeklyPlannerPage/);
  assert.match(plannerPage, /<AdminWeeklyPlannerClient/);
});

test("dnešní den je výchozí jen pro mobilní jednodenní pohled", async () => {
  const source = await readFile(new URL("./admin-weekly-planner-lab-page.tsx", import.meta.url), "utf8");
  const client = await readFile(new URL("./admin-weekly-planner-lab-client.tsx", import.meta.url), "utf8");
  assert.match(source, /const initialDate = hasInitialDay \? day! : data\.weekKey/);
  assert.match(client, /compact && !hasInitialDay/);
  assert.match(client, /data\.todayKey/);
});

test("dashboard vede přímo do hlavního planneru bez route /novy", async () => {
  const dashboard = await source("src/features/admin/lib/admin-dashboard.ts");

  assert.match(dashboard, /addSlotHref: plannerHref/);
});
