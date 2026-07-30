import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
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

test("routy planneru načítají společné FullCalendar CSS ve svých layoutech", async () => {
  const [ownerLayout, salonLayout, plannerTheme] = await Promise.all([
    source("src/app/(admin)/admin/volne-terminy/layout.tsx"),
    source("src/app/(admin)/admin/provoz/volne-terminy/layout.tsx"),
    source("src/features/admin/components/planner-theme.css"),
  ]);

  const plannerThemeImport = 'import "@/features/admin/components/planner-theme.css";';
  assert.equal(ownerLayout.split(plannerThemeImport).length - 1, 1);
  assert.equal(salonLayout.split(plannerThemeImport).length - 1, 1);
  assert.match(plannerTheme, /@import "@fullcalendar\/react\/skeleton\.css";/);
  assert.match(plannerTheme, /@import "@fullcalendar\/react\/themes\/classic\/theme\.css";/);
  assert.match(plannerTheme, /@import "@fullcalendar\/react\/themes\/classic\/palette\.css";/);
  await assert.rejects(access(new URL("src/app/(admin)/admin/volne-terminy/planner-theme.css", projectRoot)));
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
