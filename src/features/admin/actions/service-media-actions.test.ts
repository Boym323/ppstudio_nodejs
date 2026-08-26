import assert from "node:assert/strict";
import test from "node:test";

import { ServiceMediaRole } from "@/generated/prisma/browser";
import { reorderServiceGallery } from "@/features/admin/lib/service-media-reorder";

type Row = { id: string; serviceId: string; role: ServiceMediaRole; sortOrder: number };

function fakeTransaction(rows: Row[]) {
  const updates: number[] = [];
  return {
    rows,
    updates,
    serviceMedia: {
      findMany: async () => rows
        .filter((row) => row.serviceId === "service" && row.role === ServiceMediaRole.GALLERY)
        .map(({ id, sortOrder }) => ({ id, sortOrder })),
      update: async ({ where, data }: { where: { id: string }; data: { sortOrder: number } }) => {
        const current = rows.find((row) => row.id === where.id)!;
        if (rows.some((row) => row !== current && row.serviceId === current.serviceId && row.role === current.role && row.sortOrder === data.sortOrder)) {
          throw new Error("unique collision");
        }
        current.sortOrder = data.sortOrder;
        updates.push(data.sortOrder);
        return current;
      },
    },
  };
}

test("reorder galerie používá dočasné pořadí před finálním 10/20 pořadím", async () => {
  for (const [id, direction, expected] of [
    ["first", "down", ["second", "first"]],
    ["second", "up", ["second", "first"]],
  ] as const) {
    const tx = fakeTransaction([
      { id: "first", serviceId: "service", role: ServiceMediaRole.GALLERY, sortOrder: 10 },
      { id: "second", serviceId: "service", role: ServiceMediaRole.GALLERY, sortOrder: 20 },
      { id: "hero", serviceId: "service", role: ServiceMediaRole.HERO, sortOrder: 0 },
      { id: "other-service", serviceId: "other", role: ServiceMediaRole.GALLERY, sortOrder: 10 },
    ]);

    await reorderServiceGallery(tx as never, "service", id, direction);
    const gallery = tx.rows
      .filter((row) => row.serviceId === "service" && row.role === ServiceMediaRole.GALLERY)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((row) => row.id);
    assert.deepEqual(gallery, expected);
    assert.deepEqual(tx.updates, [-1, -2, 10, 20]);
    assert.equal(tx.rows.find((row) => row.id === "hero")?.sortOrder, 0);
    assert.equal(tx.rows.find((row) => row.id === "other-service")?.sortOrder, 10);
  }
});
