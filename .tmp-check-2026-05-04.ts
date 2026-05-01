import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function main() {
  const dayStart = new Date('2026-05-04T00:00:00.000Z');
  const dayEnd = new Date('2026-05-05T00:00:00.000Z');

  const slots = await prisma.availabilitySlot.findMany({
    where: {
      startsAt: { lt: dayEnd },
      endsAt: { gt: dayStart },
    },
    orderBy: [{ startsAt: 'asc' }],
    include: {
      bookings: {
        orderBy: { scheduledStartsAt: 'asc' },
        select: {
          id: true,
          status: true,
          scheduledStartsAt: true,
          scheduledEndsAt: true,
          serviceNameSnapshot: true,
          clientNameSnapshot: true,
        },
      },
    },
  });

  const bookings = await prisma.booking.findMany({
    where: {
      scheduledStartsAt: { lt: dayEnd },
      scheduledEndsAt: { gt: dayStart },
    },
    orderBy: [{ scheduledStartsAt: 'asc' }],
    select: {
      id: true,
      slotId: true,
      status: true,
      scheduledStartsAt: true,
      scheduledEndsAt: true,
      serviceNameSnapshot: true,
      clientNameSnapshot: true,
    },
  });

  console.log(JSON.stringify({ slots, bookings }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
