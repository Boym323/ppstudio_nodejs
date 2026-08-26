import { ServiceMediaRole } from "@/generated/prisma/browser";
import type { Prisma } from "@/generated/prisma/client";

export async function reorderServiceGallery(
  tx: Prisma.TransactionClient,
  serviceId: string,
  id: string,
  direction: "up" | "down",
) {
  const rows = await tx.serviceMedia.findMany({
    where: { serviceId, role: ServiceMediaRole.GALLERY },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, sortOrder: true },
  });
  const index = rows.findIndex((row) => row.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= rows.length) return false;

  const reordered = [...rows];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  const minimum = Math.min(...rows.map((row) => row.sortOrder), 0);
  await Promise.all(reordered.map((row, position) => tx.serviceMedia.update({
    where: { id: row.id },
    data: { sortOrder: minimum - position - 1 },
  })));
  await Promise.all(reordered.map((row, position) => tx.serviceMedia.update({
    where: { id: row.id },
    data: { sortOrder: (position + 1) * 10 },
  })));
  return true;
}
