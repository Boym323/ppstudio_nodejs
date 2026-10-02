import { ServiceChangeOperation } from "@/generated/prisma/browser";
import { runSerializableTransaction } from "@/lib/serializable-transaction";
import { isValidServiceSlug } from "@/features/admin/lib/service-slug-validation";

export const SERVICE_SLUG_CUTOVER_ID = "service-slug-cutover-2026-10-02";

export type ServiceSlugCutoverChange = {
  serviceId: string;
  expectedSlug: string;
  targetSlug: string;
};

export type ServiceSlugCutoverPlan = {
  cutoverId: typeof SERVICE_SLUG_CUTOVER_ID;
  actorUserId: string;
  changes: ServiceSlugCutoverChange[];
};

export class ServiceSlugCutoverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceSlugCutoverError";
  }
}

function assertPlan(plan: ServiceSlugCutoverPlan) {
  if (plan.cutoverId !== SERVICE_SLUG_CUTOVER_ID) {
    throw new ServiceSlugCutoverError(`Neznámý cutoverId: ${plan.cutoverId}`);
  }
  if (!plan.actorUserId.trim() || plan.changes.length === 0) {
    throw new ServiceSlugCutoverError("Cutover vyžaduje actorUserId a alespoň jednu změnu.");
  }

  const ids = new Set<string>();
  const expectedSlugs = new Set<string>();
  const targetSlugs = new Set<string>();
  for (const change of plan.changes) {
    if (!change.serviceId.trim() || ids.has(change.serviceId)) {
      throw new ServiceSlugCutoverError("Každá změna musí mít jedinečné stabilní serviceId.");
    }
    if (
      !isValidServiceSlug(change.expectedSlug)
      || !isValidServiceSlug(change.targetSlug)
      || change.expectedSlug === change.targetSlug
      || expectedSlugs.has(change.expectedSlug)
      || targetSlugs.has(change.targetSlug)
    ) {
      throw new ServiceSlugCutoverError(`Neplatný nebo duplicitní slug služby ${change.serviceId}.`);
    }
    ids.add(change.serviceId);
    expectedSlugs.add(change.expectedSlug);
    targetSlugs.add(change.targetSlug);
  }
}

async function loadCutoverState(
  tx: Parameters<typeof runSerializableTransaction>[0] extends (tx: infer T) => unknown ? T : never,
  plan: ServiceSlugCutoverPlan,
) {
  const [services, aliases, targetServices, targetAliases] = await Promise.all([
    tx.service.findMany({
      where: { id: { in: plan.changes.map((change) => change.serviceId) } },
      select: { id: true, slug: true },
    }),
    tx.serviceSlugAlias.findMany({
      where: { slug: { in: plan.changes.map((change) => change.expectedSlug) } },
      select: { slug: true, serviceId: true },
    }),
    tx.service.findMany({
      where: { slug: { in: plan.changes.map((change) => change.targetSlug) } },
      select: { id: true, slug: true },
    }),
    tx.serviceSlugAlias.findMany({
      where: { slug: { in: plan.changes.map((change) => change.targetSlug) } },
      select: { slug: true, serviceId: true },
    }),
  ]);

  const servicesById = new Map(services.map((service) => [service.id, service]));
  const aliasesBySlug = new Map(aliases.map((alias) => [alias.slug, alias]));
  const targetServicesBySlug = new Map(targetServices.map((service) => [service.slug, service]));
  const targetAliasesBySlug = new Map(targetAliases.map((alias) => [alias.slug, alias]));

  return plan.changes.map((change) => {
    const service = servicesById.get(change.serviceId);
    if (!service) throw new ServiceSlugCutoverError(`Služba ${change.serviceId} neexistuje.`);

    const targetService = targetServicesBySlug.get(change.targetSlug);
    const targetAlias = targetAliasesBySlug.get(change.targetSlug);
    if ((targetService && targetService.id !== service.id) || targetAlias) {
      throw new ServiceSlugCutoverError(`Cílový slug ${change.targetSlug} už používá jiná služba nebo alias.`);
    }

    return {
      change,
      service,
      expectedAlias: aliasesBySlug.get(change.expectedSlug),
    };
  });
}

function isAlreadyApplied(row: Awaited<ReturnType<typeof loadCutoverState>>[number]) {
  return row.service.slug === row.change.targetSlug
    && row.expectedAlias?.serviceId === row.service.id;
}

/**
 * Přesune veřejné URL na nové slugy a zachová staré jako neměnné aliasy.
 * Plán je fail-closed: přijímá pouze očekávaný stav nebo plně aplikovaný stav.
 */
export async function previewServiceSlugCutover(plan: ServiceSlugCutoverPlan) {
  assertPlan(plan);
  return runSerializableTransaction(async (tx) => {
    const rows = await loadCutoverState(tx, plan);
    return rows.map((row) => ({
      serviceId: row.service.id,
      currentSlug: row.service.slug,
      expectedSlug: row.change.expectedSlug,
      targetSlug: row.change.targetSlug,
      expectedMatches: row.service.slug === row.change.expectedSlug && !row.expectedAlias,
      alreadyApplied: isAlreadyApplied(row),
    }));
  });
}

export async function applyServiceSlugCutover(plan: ServiceSlugCutoverPlan) {
  assertPlan(plan);
  return runSerializableTransaction(async (tx) => {
    const rows = await loadCutoverState(tx, plan);
    if (rows.every(isAlreadyApplied)) {
      return { status: "already-applied" as const, changedServiceIds: [] };
    }

    const unexpected = rows.filter((row) => (
      row.service.slug !== row.change.expectedSlug || row.expectedAlias !== undefined
    ));
    if (unexpected.length > 0) {
      throw new ServiceSlugCutoverError(
        `Cutover odmítnut: aktuální slugy neodpovídají plánu (${unexpected.map((row) => row.service.id).join(", ")}).`,
      );
    }

    for (const row of rows) {
      await tx.serviceSlugAlias.create({
        data: {
          serviceId: row.service.id,
          slug: row.change.expectedSlug,
        },
      });
      await tx.service.update({
        where: { id: row.service.id },
        data: { slug: row.change.targetSlug },
      });
      await tx.serviceChangeLog.create({
        data: {
          serviceId: row.service.id,
          actorUserId: plan.actorUserId,
          operation: ServiceChangeOperation.UPDATE_OPERATIONAL_DETAILS,
          before: { slug: row.change.expectedSlug, cutoverId: plan.cutoverId },
          after: { slug: row.change.targetSlug, cutoverId: plan.cutoverId },
        },
      });
    }

    return { status: "applied" as const, changedServiceIds: rows.map((row) => row.service.id) };
  });
}
