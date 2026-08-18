import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { SITE_SETTINGS_ID } from "@/lib/site-settings";

import type { DayLunchMode } from "./booking-schedule-optimization";

type AutoLunchPolicyReader = Pick<Prisma.TransactionClient, "siteSettings" | "autoLunchDayOverride">;

export type AutoLunchPolicySnapshot = {
  globalAutoLunchEnabled: boolean;
  dayLunchModes: Record<string, DayLunchMode>;
};

/** Načte globální stav a všechny OFF override najednou; absence záznamu vždy znamená AUTO. */
export async function loadAutoLunchPolicySnapshot(
  reader: AutoLunchPolicyReader,
  localDates: Iterable<string>,
): Promise<AutoLunchPolicySnapshot> {
  const dateKeys = [...new Set(localDates)];
  const [settings, overrides] = await Promise.all([
    reader.siteSettings.findUnique({
      where: { id: SITE_SETTINGS_ID },
      select: { autoLunchEnabled: true },
    }),
    dateKeys.length
      ? reader.autoLunchDayOverride.findMany({
          where: { dateKey: { in: dateKeys } },
          select: { dateKey: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    // Bez singletonu zůstává bezpečně zachováno produkční výchozí chování Fáze 2.
    globalAutoLunchEnabled: settings?.autoLunchEnabled ?? true,
    dayLunchModes: Object.fromEntries(overrides.map((override) => [override.dateKey, "OFF" as const])),
  };
}
