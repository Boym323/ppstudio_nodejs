"use server";

import { z } from "zod";

import { type AdminArea } from "@/config/navigation";
import {
  applyAvailabilitySelection,
  syncPlannerWeekDraft,
  applyWeeklyTemplate,
  clearPlannerDay,
  copyPlannerWeek,
  PlannerMutationError,
  type PlannerMutationResult,
  type WeeklyDraftInput,
  type WeeklyTemplateInput,
} from "@/features/admin/lib/admin-slots";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";
import { sendOwnerSystemErrorPushover } from "@/lib/notifications/pushover";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const PLANNER_DAY_CELLS = (20 - 6) * 2;

const selectionSchema = z.object({
  weekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startCell: z.number().int().min(0).max(PLANNER_DAY_CELLS),
  endCell: z.number().int().min(0).max(PLANNER_DAY_CELLS),
  mode: z.enum(["add", "remove"]),
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
          startCell: z.number().int().min(0).max(PLANNER_DAY_CELLS),
          endCell: z.number().int().min(0).max(PLANNER_DAY_CELLS),
        }),
      ),
    }),
  ),
});

const weeklyDraftSchema = z.object({
  weekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.array(
    z.object({
      dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      intervals: z.array(
        z.object({
          startCell: z.number().int().min(0).max(PLANNER_DAY_CELLS),
          endCell: z.number().int().min(0).max(PLANNER_DAY_CELLS),
        }),
      ),
    }),
  ),
});

function sanitizeDraftIntervals(intervals: Array<{ startCell: number; endCell: number }>) {
  const normalized = intervals
    .map((interval) => ({
      startCell: Math.max(0, Math.min(PLANNER_DAY_CELLS, Math.trunc(interval.startCell))),
      endCell: Math.max(0, Math.min(PLANNER_DAY_CELLS, Math.trunc(interval.endCell))),
    }))
    .filter((interval) => interval.endCell > interval.startCell)
    .sort((left, right) => left.startCell - right.startCell);

  const merged: Array<{ startCell: number; endCell: number }> = [];

  for (const interval of normalized) {
    const last = merged[merged.length - 1];

    if (!last || interval.startCell > last.endCell) {
      merged.push(interval);
      continue;
    }

    last.endCell = Math.max(last.endCell, interval.endCell);
  }

  return merged;
}

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
  const dbUser = await prisma.adminUser.findFirst({
    where: {
      email: {
        equals: session.email.trim(),
        mode: "insensitive",
      },
    },
    select: {
      id: true,
    },
  });

  return {
    actorUserId: dbUser?.id ?? null,
  };
}

async function mapPlannerError(
  error: unknown,
  fallbackMessage: string,
  context: {
    area: AdminArea;
    operation: string;
    contextId?: string;
  },
): Promise<PlannerMutationResult> {
  if (error instanceof PlannerMutationError) {
    return {
      ok: false,
      message: error.message,
      weekKey: "",
    };
  }

  console.error("Planner action failed", error);

  await sendOwnerSystemErrorPushover({
    title: "PP Studio - systemova chyba",
    message: `Planner akce selhala (${context.operation}).`,
    context: {
      contextId: context.contextId ?? `planner-${context.area}-${context.operation}`,
      area: context.area,
      operation: context.operation,
    },
    error,
  });

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
    return mapPlannerError(error, "Změnu dostupnosti se teď nepodařilo uložit.", {
      area,
      operation: "apply-selection",
      contextId: `${area}:${parsed.data.weekKey}:${parsed.data.dateKey}`,
    });
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
    return mapPlannerError(error, "Den se teď nepodařilo upravit.", {
      area,
      operation: "clear-day",
      contextId: `${area}:${parsed.data.weekKey}:${parsed.data.dateKey}`,
    });
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
    return mapPlannerError(error, "Kopírování týdne se teď nepodařilo dokončit.", {
      area,
      operation: "copy-week",
      contextId: `${area}:${parsed.data.sourceWeekKey}:${parsed.data.targetWeekKey}`,
    });
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
    return mapPlannerError(error, "Šablonu se teď nepodařilo použít.", {
      area,
      operation: "apply-template",
      contextId: `${area}:${parsed.data.weekKey}:template`,
    });
  }
}

export async function syncPlannerWeekDraftAction(
  area: AdminArea,
  rawInput: unknown,
): Promise<PlannerMutationResult> {
  const access = await withPlannerAccess(area);
  const parsed = weeklyDraftSchema.safeParse(rawInput);

  if (!parsed.success) {
    const fallback = z
      .object({
        weekKey: z.string(),
        days: z.array(
          z.object({
            dateKey: z.string(),
            intervals: z.array(
              z.object({
                startCell: z.coerce.number(),
                endCell: z.coerce.number(),
              }),
            ),
          }),
        ),
      })
      .safeParse(rawInput);

    if (!fallback.success) {
      return {
        ok: false,
        message: "Koncept týdne už není platný. Zkuste změny vytvořit znovu.",
        weekKey: "",
      };
    }

    const recoveredPayload = {
      weekKey: fallback.data.weekKey,
      days: fallback.data.days.map((day) => ({
        dateKey: day.dateKey,
        intervals: sanitizeDraftIntervals(day.intervals),
      })),
    };
    const recoveredParsed = weeklyDraftSchema.safeParse(recoveredPayload);

    if (!recoveredParsed.success) {
      return {
        ok: false,
        message: "Koncept týdne už není platný. Zkuste změny vytvořit znovu.",
        weekKey: "",
      };
    }

    try {
      const result = await syncPlannerWeekDraft(area, {
        weekKey: recoveredParsed.data.weekKey,
        days: recoveredParsed.data.days as WeeklyDraftInput,
        actorUserId: access.actorUserId,
      });
      revalidatePlanner(area);
      return result;
    } catch (error) {
      return mapPlannerError(error, "Koncept týdne se teď nepodařilo publikovat.", {
        area,
        operation: "sync-draft",
        contextId: `${area}:${recoveredParsed.data.weekKey}:draft`,
      });
    }
  }

  try {
    const result = await syncPlannerWeekDraft(area, {
      weekKey: parsed.data.weekKey,
      days: parsed.data.days as WeeklyDraftInput,
      actorUserId: access.actorUserId,
    });
    revalidatePlanner(area);
    return result;
  } catch (error) {
    return mapPlannerError(error, "Koncept týdne se teď nepodařilo publikovat.", {
      area,
      operation: "sync-draft",
      contextId: `${area}:${parsed.data.weekKey}:draft`,
    });
  }
}
