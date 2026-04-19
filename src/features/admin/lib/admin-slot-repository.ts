import {
  AvailabilitySlotStatus,
  type Prisma,
  type Service,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

type DbClient = Prisma.TransactionClient | typeof prisma;

export type SlotListFilters = {
  date?: Date;
  status?: AvailabilitySlotStatus;
};

function buildDateWhere(date?: Date): Prisma.AvailabilitySlotWhereInput | undefined {
  if (!date) {
    return undefined;
  }

  const startsAt = new Date(date);
  startsAt.setHours(0, 0, 0, 0);
  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + 1);

  return {
    startsAt: {
      gte: startsAt,
      lt: endsAt,
    },
  };
}

export async function listAdminSlots(filters: SlotListFilters) {
  return prisma.availabilitySlot.findMany({
    where: {
      ...buildDateWhere(filters.date),
      ...(filters.status ? { status: filters.status } : null),
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }],
    take: 80,
    include: {
      createdByUser: {
        select: {
          id: true,
          name: true,
        },
      },
      allowedServices: {
        orderBy: {
          service: {
            name: "asc",
          },
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              durationMinutes: true,
              isActive: true,
            },
          },
        },
      },
      bookings: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          status: true,
          serviceId: true,
          clientNameSnapshot: true,
        },
      },
    },
  });
}

export async function listActiveServicesForSlotForm() {
  return prisma.service.findMany({
    where: {
      isActive: true,
      category: {
        is: {
          isActive: true,
        },
      },
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      durationMinutes: true,
      isActive: true,
      category: {
        select: {
          name: true,
        },
      },
    },
  });
}

export async function getServicesByIds(serviceIds: string[], db: DbClient = prisma): Promise<Service[]> {
  if (serviceIds.length === 0) {
    return [];
  }

  return db.service.findMany({
    where: {
      id: {
        in: serviceIds,
      },
    },
  });
}

export async function findSlotOverlap(
  input: {
    startsAt: Date;
    endsAt: Date;
    excludeSlotId?: string;
  },
  db: DbClient = prisma,
) {
  return db.availabilitySlot.findFirst({
    where: {
      id: input.excludeSlotId ? { not: input.excludeSlotId } : undefined,
      status: {
        in: [AvailabilitySlotStatus.DRAFT, AvailabilitySlotStatus.PUBLISHED],
      },
      startsAt: {
        lt: input.endsAt,
      },
      endsAt: {
        gt: input.startsAt,
      },
    },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
    },
  });
}

export async function getSlotDetailById(slotId: string) {
  return prisma.availabilitySlot.findUnique({
    where: {
      id: slotId,
    },
    include: {
      createdByUser: {
        select: {
          name: true,
        },
      },
      allowedServices: {
        orderBy: {
          service: {
            name: "asc",
          },
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              durationMinutes: true,
              isActive: true,
            },
          },
        },
      },
      bookings: {
        orderBy: [{ scheduledStartsAt: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          status: true,
          serviceId: true,
          clientNameSnapshot: true,
          serviceNameSnapshot: true,
          scheduledStartsAt: true,
          scheduledEndsAt: true,
        },
      },
    },
  });
}

export async function getSlotForWrite(slotId: string, db: DbClient = prisma) {
  return db.availabilitySlot.findUnique({
    where: {
      id: slotId,
    },
    include: {
      allowedServices: {
        select: {
          serviceId: true,
        },
      },
      bookings: {
        select: {
          id: true,
          status: true,
          serviceId: true,
        },
      },
    },
  });
}

export async function createSlotRecord(
  input: Prisma.AvailabilitySlotCreateInput,
  db: DbClient = prisma,
) {
  return db.availabilitySlot.create({
    data: input,
    select: {
      id: true,
    },
  });
}

export async function updateSlotRecord(
  slotId: string,
  input: Prisma.AvailabilitySlotUpdateInput,
  db: DbClient = prisma,
) {
  return db.availabilitySlot.update({
    where: {
      id: slotId,
    },
    data: input,
    select: {
      id: true,
    },
  });
}

export async function deleteSlotRecord(slotId: string, db: DbClient = prisma) {
  return db.availabilitySlot.delete({
    where: {
      id: slotId,
    },
    select: {
      id: true,
    },
  });
}
