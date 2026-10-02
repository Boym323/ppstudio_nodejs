import "server-only";

import { ServiceChangeOperation } from "@/generated/prisma/browser";
import { Prisma } from "@/generated/prisma/client";
import { runSerializableTransaction } from "@/lib/serializable-transaction";
import {
  isValidServiceSlug,
  SERVICE_SLUG_MAX_LENGTH,
} from "@/features/admin/lib/service-slug-validation";

export { isValidServiceSlug, normalizeServiceSlugInput, SERVICE_SLUG_MAX_LENGTH, SERVICE_SLUG_PATTERN } from "@/features/admin/lib/service-slug-validation";

export class ServiceSlugChangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceSlugChangeError";
  }
}

export async function changeServiceSlug(input: {
  serviceId: string;
  targetSlug: string;
  actorUserId: string;
}) {
  const targetSlug = input.targetSlug.trim();

  if (!isValidServiceSlug(targetSlug)) {
    throw new ServiceSlugChangeError(
      `Slug musí mít 1–${SERVICE_SLUG_MAX_LENGTH} znaků a obsahovat pouze malá písmena, číslice a jednoduché spojovníky.`,
    );
  }

  return runSerializableTransaction(async (tx) => {
    const service = await tx.service.findUnique({
      where: { id: input.serviceId },
      select: { id: true, slug: true },
    });
    if (!service) {
      throw new ServiceSlugChangeError("Službu se nepodařilo najít.");
    }

    if (service.slug === targetSlug) {
      return { changed: false as const, beforeSlug: service.slug, afterSlug: service.slug };
    }

    const [existingService, existingAlias] = await Promise.all([
      tx.service.findUnique({ where: { slug: targetSlug }, select: { id: true } }),
      tx.serviceSlugAlias.findUnique({ where: { slug: targetSlug }, select: { serviceId: true } }),
    ]);

    if (existingService || existingAlias) {
      throw new ServiceSlugChangeError(
        "Tato URL byla již použita jinou nebo historickou verzí služby. Zvolte jiný slug.",
      );
    }

    try {
      await tx.serviceSlugAlias.create({
        data: { serviceId: service.id, slug: service.slug },
      });
      await tx.service.update({
        where: { id: service.id },
        data: { slug: targetSlug },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ServiceSlugChangeError(
          "Tato URL byla již použita jinou nebo historickou verzí služby. Zvolte jiný slug.",
        );
      }
      throw error;
    }
    await tx.serviceChangeLog.create({
      data: {
        serviceId: service.id,
        actorUserId: input.actorUserId,
        operation: ServiceChangeOperation.CHANGE_PUBLIC_SLUG,
        before: { slug: service.slug },
        after: { slug: targetSlug },
      },
    });

    return { changed: true as const, beforeSlug: service.slug, afterSlug: targetSlug };
  });
}
