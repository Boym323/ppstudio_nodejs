import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const settingsActionsPath = new URL("./settings-actions.ts", import.meta.url);

async function actionSource() {
  return readFile(settingsActionsPath, "utf8");
}

test("denní AUTO/OFF používá oprávnění volných termínů pro OWNER i SALON", async () => {
  const source = await actionSource();
  const action = source.slice(
    source.indexOf("export async function updateAutoLunchDayModeAction"),
    source.indexOf("export async function updateEmailSettingsAction"),
  );

  assert.match(source, /area: z\.enum\(\["owner", "salon"\]\)/);
  assert.match(source, /getCurrentPlannerDbUser\(area: AdminArea\)[\s\S]*requireAdminSectionAccess\(area, "volne-terminy"\)/);
  assert.match(action, /getCurrentPlannerDbUser\(parsed\.data\.area\)/);
  assert.doesNotMatch(action, /getCurrentOwnerDbUser/);
  assert.match(action, /actorRole: actor\.role, adminArea: parsed\.data\.area/);
});

test("globální autoLunchEnabled zůstává v OWNER nastavení", async () => {
  const source = await actionSource();
  const bookingSettingsAction = source.slice(source.indexOf("export async function updateBookingSettingsAction"), source.indexOf("export async function updateAutoLunchDayModeAction"));

  assert.match(bookingSettingsAction, /const actorUserId = await getActorUserId\(\)/);
  assert.match(source, /async function getActorUserId\(\)[\s\S]*requireAdminSectionAccess\("owner", "nastaveni"\)/);
});

test("AUTO a OFF zachovávají idempotentní persistenci override", async () => {
  const source = await actionSource();
  const action = source.slice(
    source.indexOf("export async function updateAutoLunchDayModeAction"),
    source.indexOf("export async function updateEmailSettingsAction"),
  );

  assert.match(action, /if \(\(parsed\.data\.mode === "OFF"\) === Boolean\(previous\)\) \{[\s\S]*return \{ ok: true, mode: parsed\.data\.mode \}/);
  assert.match(action, /autoLunchDayOverride\.upsert\(/);
  assert.match(action, /autoLunchDayOverride\.deleteMany\(\{ where: \{ dateKey: parsed\.data\.dateKey \} \}\)/);
});
