import "server-only";

import { ServiceChangeOperation } from "@prisma/client";

import { runSerializableTransaction } from "@/lib/serializable-transaction";

export async function setServiceOperationalFlag(input: {
  serviceId: string;
  actorUserId: string;
  field: "isActive" | "isPubliclyBookable";
  value: boolean;
}) {
  return runSerializableTransaction(async (tx) => {
    const service = await tx.service.findUnique({
      where: { id: input.serviceId },
      select: { id: true, isActive: true, isPubliclyBookable: true },
    });
    if (!service) return false;

    if (service[input.field] === input.value) return true;

    await tx.service.update({
      where: { id: service.id },
      data: { [input.field]: input.value },
    });
    await tx.serviceChangeLog.create({
      data: {
        serviceId: service.id,
        actorUserId: input.actorUserId,
        operation: input.field === "isActive"
          ? ServiceChangeOperation.TOGGLE_ACTIVE
          : ServiceChangeOperation.TOGGLE_BOOKABLE,
        before: { [input.field]: service[input.field] },
        after: { [input.field]: input.value },
      },
    });
    return true;
  });
}
