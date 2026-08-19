import { prisma } from "@/lib/prisma";

export async function getManualBookingClientById(clientId: string) {
  const client = await prisma.client.findUnique({
    where: {
      id: clientId,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      internalNote: true,
      isActive: true,
    },
  });

  if (!client) {
    return null;
  }

  return {
    ...client,
    email: client.email ?? "",
  };
}

