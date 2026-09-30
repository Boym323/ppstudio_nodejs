import { ServiceChangeOperation } from "@/generated/prisma/browser";
import { runSerializableTransaction } from "@/lib/serializable-transaction";

export const SERVICE_CATALOG_CUTOVER_ID = "service-catalog-cutover-2026-10-01";

export type ServiceCatalogCutoverChange = {
  serviceId: string;
  expected: ServiceCatalogCutoverValues;
  target: ServiceCatalogCutoverValues;
};

export type ServiceCatalogCutoverValues = {
  name: string;
  publicName: string | null;
  priceFromCzk: number | null;
  durationMinutes: number;
};

export type ServiceCatalogCutoverPlan = {
  cutoverId: typeof SERVICE_CATALOG_CUTOVER_ID;
  actorUserId: string;
  changes: ServiceCatalogCutoverChange[];
};

export class ServiceCatalogCutoverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceCatalogCutoverError";
  }
}

type CurrentService = ServiceCatalogCutoverValues & { id: string; slug: string };

function hasSameValues(
  current: ServiceCatalogCutoverValues,
  values: ServiceCatalogCutoverValues,
) {
  return current.name === values.name
    && current.publicName === values.publicName
    && current.priceFromCzk === values.priceFromCzk
    && current.durationMinutes === values.durationMinutes;
}

function assertPlan(plan: ServiceCatalogCutoverPlan) {
  if (plan.cutoverId !== SERVICE_CATALOG_CUTOVER_ID) {
    throw new ServiceCatalogCutoverError(`Neznámý cutoverId: ${plan.cutoverId}`);
  }
  if (!plan.actorUserId.trim() || plan.changes.length === 0) {
    throw new ServiceCatalogCutoverError("Cutover vyžaduje actorUserId a alespoň jednu změnu.");
  }

  const ids = new Set<string>();
  for (const change of plan.changes) {
    if (!change.serviceId.trim() || ids.has(change.serviceId)) {
      throw new ServiceCatalogCutoverError("Každá změna musí mít jedinečné stabilní serviceId.");
    }
    ids.add(change.serviceId);
    for (const values of [change.expected, change.target]) {
      if (
        !values.name.trim()
        || (values.priceFromCzk !== null && (!Number.isInteger(values.priceFromCzk) || values.priceFromCzk < 0))
        || !Number.isInteger(values.durationMinutes)
        || values.durationMinutes <= 0
      ) {
        throw new ServiceCatalogCutoverError(`Neplatné očekávané nebo cílové hodnoty služby ${change.serviceId}.`);
      }
    }
  }
}

async function loadCurrentServices(tx: Parameters<typeof runSerializableTransaction>[0] extends (tx: infer T) => unknown ? T : never, plan: ServiceCatalogCutoverPlan) {
  const services = await tx.service.findMany({
    where: { id: { in: plan.changes.map((change) => change.serviceId) } },
    select: { id: true, slug: true, name: true, publicName: true, priceFromCzk: true, durationMinutes: true },
  });
  const byId = new Map(services.map((service) => [service.id, service]));
  return plan.changes.map((change) => {
    const service = byId.get(change.serviceId);
    if (!service) throw new ServiceCatalogCutoverError(`Služba ${change.serviceId} neexistuje.`);
    return { change, service: service satisfies CurrentService };
  });
}

export async function previewServiceCatalogCutover(plan: ServiceCatalogCutoverPlan) {
  assertPlan(plan);
  return runSerializableTransaction(async (tx) => {
    const rows = await loadCurrentServices(tx, plan);
    return rows.map(({ change, service }) => ({
      serviceId: service.id,
      slug: service.slug,
      current: { name: service.name, publicName: service.publicName, priceFromCzk: service.priceFromCzk, durationMinutes: service.durationMinutes },
      expectedMatches: hasSameValues(service, change.expected),
      alreadyApplied: hasSameValues(service, change.target),
      target: change.target,
    }));
  });
}

/**
 * Atomicky přejmenuje a přecení výhradně existující Service řádky.
 * Již kompletně aplikovaný plán je no-op; částečný či cizí stav fail-closed odmítne.
 */
export async function applyServiceCatalogCutover(plan: ServiceCatalogCutoverPlan) {
  assertPlan(plan);
  return runSerializableTransaction(async (tx) => {
    const rows = await loadCurrentServices(tx, plan);
    const allApplied = rows.every(({ change, service }) => hasSameValues(service, change.target));
    if (allApplied) return { status: "already-applied" as const, changedServiceIds: [] };

    const unexpected = rows.filter(({ change, service }) => !hasSameValues(service, change.expected));
    if (unexpected.length > 0) {
      throw new ServiceCatalogCutoverError(
        `Cutover odmítnut: aktuální hodnoty neodpovídají plánu (${unexpected.map(({ service }) => service.id).join(", ")}).`,
      );
    }

    for (const { change, service } of rows) {
      await tx.service.update({
        where: { id: service.id },
        data: {
          name: change.target.name,
          publicName: change.target.publicName,
          priceFromCzk: change.target.priceFromCzk,
          durationMinutes: change.target.durationMinutes,
        },
      });
      if (service.priceFromCzk !== change.target.priceFromCzk) {
        await tx.servicePriceChangeLog.create({
          data: { serviceId: service.id, changedByUserId: plan.actorUserId, oldPriceFromCzk: service.priceFromCzk, newPriceFromCzk: change.target.priceFromCzk },
        });
      }
      await tx.serviceChangeLog.create({
        data: {
          serviceId: service.id,
          actorUserId: plan.actorUserId,
          operation: ServiceChangeOperation.UPDATE_OPERATIONAL_DETAILS,
          before: { name: service.name, publicName: service.publicName, priceFromCzk: service.priceFromCzk, durationMinutes: service.durationMinutes, cutoverId: plan.cutoverId },
          after: { name: change.target.name, publicName: change.target.publicName, priceFromCzk: change.target.priceFromCzk, durationMinutes: change.target.durationMinutes, cutoverId: plan.cutoverId },
        },
      });
    }
    return { status: "applied" as const, changedServiceIds: rows.map(({ service }) => service.id) };
  });
}
