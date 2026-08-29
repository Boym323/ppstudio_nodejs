"use server";

import { z } from "zod";

import { type AdminArea } from "@/config/navigation";
import {
  applyAvailabilitySelection,
  PlannerMutationError,
  type PlannerMutationResult,
} from "@/features/admin/lib/admin-slots";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";
import { sendOwnerSystemErrorPushover } from "@/lib/notifications/pushover";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { PLANNER_CELL_COUNT } from "@/features/admin/lib/admin-slots/time";

const selectionSchema = z.object({
  weekKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startCell: z.number().multipleOf(0.5).min(0).max(PLANNER_CELL_COUNT),
  endCell: z.number().multipleOf(0.5).min(0).max(PLANNER_CELL_COUNT),
  mode: z.enum(["add", "remove"]),
  operationId: z.string().uuid(),
  revertedOperationId: z.string().uuid().optional(),
});

function getPlannerPaths(area: AdminArea) {
  const rootPath = area === "owner" ? "/admin/volne-terminy" : "/admin/provoz/volne-terminy";

  return [
    rootPath,
    area === "owner" ? "/admin" : "/admin/provoz",
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
      role: true,
    },
  });

  return {
    actorUserId: dbUser?.id ?? null,
    actorRole: dbUser?.role ?? null,
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
      actorRole: access.actorRole,
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
