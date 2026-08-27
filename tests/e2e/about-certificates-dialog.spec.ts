import { expect, test } from "@playwright/test";
import { MediaCollectionType } from "@/generated/prisma/client";

import { createMedia, deleteMedia } from "../../src/features/media/lib/media-library";
import { prisma } from "../../src/lib/prisma";

const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test("certifikát vrací focus na stejný trigger, který dialog otevřel", async ({ page }) => {
  const token = `e2e-certificate-${Date.now()}`;
  const collection = await prisma.mediaCollection.upsert({
    where: { type: MediaCollectionType.CERTIFICATES },
    create: { type: MediaCollectionType.CERTIFICATES },
    update: {},
  });
  const assets = await Promise.all(["A", "B"].map((suffix) => createMedia({
    file: new File([image], `${token}-${suffix}.png`, { type: "image/png" }),
    isPublished: true,
    title: `${token} certifikát ${suffix}`,
    altText: `${token} alt ${suffix}`,
  })));

  try {
    const last = await prisma.mediaCollectionItem.aggregate({ where: { collectionId: collection.id }, _max: { sortOrder: true } });
    await prisma.mediaCollectionItem.createMany({
      data: assets.map((asset, index) => ({ collectionId: collection.id, mediaAssetId: asset.id, sortOrder: (last._max.sortOrder ?? -1) + index + 1 })),
    });

    await page.goto("/o-mne");
    for (const [index, asset] of assets.entries()) {
      const trigger = page.getByRole("button", { name: new RegExp(asset.title ?? `${token} certifikát ${index === 0 ? "A" : "B"}`) });
      await trigger.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
  } finally {
    await prisma.mediaCollectionItem.deleteMany({ where: { mediaAssetId: { in: assets.map((asset) => asset.id) } } });
    await Promise.all(assets.map((asset) => deleteMedia(asset.id)));
  }
});
