import { prisma } from "@/lib/prisma";
import { isMergedClientProfile } from "@/features/clients/lib/client-merge-marker";

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

  if (!client || isMergedClientProfile(client)) {
    return null;
  }

  return {
    ...client,
    email: client.email ?? "",
  };
}

