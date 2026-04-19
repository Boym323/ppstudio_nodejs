"use server";

import { z } from "zod";

import { type AdminArea } from "@/config/navigation";
import {
  applyAvailabilitySelection,
  applyWeeklyTemplate,
  clearPlannerDay,
  copyPlannerDay,
  copyPlannerWeek,
  PlannerMutationError,
  type PlannerMutationResult,
  type WeeklyTemplateInput,
} from "@/features/admin/lib/admin-slots";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";
import { revalidatePath } from "next/cache";

const selectionSchema = z.object({
  weekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startCell: z.number().int().min(0).max(48),
  endCell: z.number().int().min(0).max(48),
  mode: z.enum(["add", "remove"]),
});

const dayCopySchema = z.object({
  weekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceDateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetDateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const clearDaySchema = z.object({
  weekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const copyWeekSchema = z.object({
  sourceWeekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targetWeekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const weeklyTemplateSchema = z.object({
  weekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  template: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      intervals: z.array(
        z.object({
          startCell: z.number().int().min(0).max(48),
          endCell: z.number().int().min(0).max(48),
        }),
      ),
    }),
  ),
});

function getPlannerPaths(area: AdminArea) {
  const rootPath = area === "owner" ? "/admin/volne-terminy" : "/admin/provoz/volne-terminy";

  return [
    rootPath,
    `${rootPath}/novy`,
    area === "owner" ? "/admin" : "/admin/provoz",
    area === "owner" ? "/admin/volne-terminy" : "/admin/provoz/volne-terminy",
  ];
}

function revalidatePlanner(area: AdminArea) {
  for (const path of getPlannerPaths(area)) {
    revalidatePath(path);
  }
}

async function withPlannerAccess(area: AdminArea) {
  const session = await requireAdminSectionAccess(area, "volne-terminy");

  return {
    actorUserId: session.sub,
  };
}

function mapPlannerError(error: unknown, fallbackMessage: string): PlannerMutationResult {
  if (error instanceof PlannerMutationError) {
    return {
      ok: false,
      message: error.message,
      weekKey: "",
    };
  }

  console.error("Planner action failed", error);

  return {
    ok: false,
    message: fallbackMessage,
    weekKey: "",
  };
}

export async function applyPlannerSelectionAction(
  area: AdminArea,
  rawInput: unknown,
): Promise<PlannerMutationResult> {
  const access = await withPlannerAccess(area);
  const parsed = selectionSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Vybraný rozsah se nepodařilo přečíst. Zkuste to prosím znovu.",
      weekKey: "",
    };
  }

  try {
    const result = await applyAvailabilitySelection(area, {
      ...parsed.data,
      actorUserId: access.actorUserId,
    });

    revalidatePlanner(area);
    return result;
  } catch (error) {
    return mapPlannerError(error, "Změnu dostupnosti se teď nepodařilo uložit.");
  }
}

export async function clearPlannerDayAction(
  area: AdminArea,
  rawInput: unknown,
): Promise<PlannerMutationResult> {
  const parsed = clearDaySchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Nepodařilo se určit den, který se má vyčistit.",
      weekKey: "",
    };
  }

  try {
    await withPlannerAccess(area);
    const result = await clearPlannerDay(area, parsed.data);
    revalidatePlanner(area);
    return result;
  } catch (error) {
    return mapPlannerError(error, "Den se teď nepodařilo upravit.");
  }
}

export async function copyPlannerDayAction(
  area: AdminArea,
  rawInput: unknown,
): Promise<PlannerMutationResult> {
  const access = await withPlannerAccess(area);
  const parsed = dayCopySchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Nepodařilo se přečíst zdrojový nebo cílový den.",
      weekKey: "",
    };
  }

  try {
    const result = await copyPlannerDay(area, {
      ...parsed.data,
      actorUserId: access.actorUserId,
    });
    revalidatePlanner(area);
    return result;
  } catch (error) {
    return mapPlannerError(error, "Kopírování dne se teď nepodařilo dokončit.");
  }
}

export async function copyPlannerWeekAction(
  area: AdminArea,
  rawInput: unknown,
): Promise<PlannerMutationResult> {
  const access = await withPlannerAccess(area);
  const parsed = copyWeekSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Nepodařilo se přečíst zdrojový nebo cílový týden.",
      weekKey: "",
    };
  }

  try {
    const result = await copyPlannerWeek(area, {
      ...parsed.data,
      actorUserId: access.actorUserId,
    });
    revalidatePlanner(area);
    return result;
  } catch (error) {
    return mapPlannerError(error, "Kopírování týdne se teď nepodařilo dokončit.");
  }
}

export async function applyWeeklyTemplateAction(
  area: AdminArea,
  rawInput: unknown,
): Promise<PlannerMutationResult> {
  const access = await withPlannerAccess(area);
  const parsed = weeklyTemplateSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Uložená šablona týdne už není platná.",
      weekKey: "",
    };
  }

  try {
    const result = await applyWeeklyTemplate(area, {
      weekKey: parsed.data.weekKey,
      template: parsed.data.template as WeeklyTemplateInput,
      actorUserId: access.actorUserId,
    });
    revalidatePlanner(area);
    return result;
  } catch (error) {
    return mapPlannerError(error, "Šablonu se teď nepodařilo použít.");
  }
}
