import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.ADMIN_OWNER_EMAIL ??= "owner@example.com";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

function isPrismaError(error: unknown, code: string) {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

async function createAsset() {
  const { prisma } = await import("@/lib/prisma");
  const suffix = randomUUID();

  try {
    return await prisma.mediaAsset.create({
    data: {
      originalFilename: `${suffix}.jpg`,
      fileName: `${suffix}.jpg`,
      mimeType: "image/jpeg",
      extension: "jpg",
      size: 1,
      storagePath: `test/media-library-v2/${suffix}.jpg`,
      url: `/media/public/test/media-library-v2/${suffix}.jpg`,
    },
    });
  } catch (error) {
    const details = error as { name?: string; code?: string; meta?: unknown; message?: string; cause?: unknown };
    console.error('MediaAsset fixture failed', { name: details.name, code: details.code, meta: details.meta, message: details.message, cause: details.cause });
    throw error;
  }
}

dbTest("MediaCollectionItem zachovává unikátní a deterministické pořadí a blokuje smazání assetu", async () => {
  const [{ prisma }, { getMediaAssetUsage }] = await Promise.all([
    import("@/lib/prisma"),
    import("./media-asset-usage"),
  ]);
  const [firstAsset, secondAsset, thirdAsset] = await Promise.all([
    createAsset(),
    createAsset(),
    createAsset(),
  ]);
  const existingCollections = await prisma.mediaCollection.findMany({ select: { type: true } });
  const collectionTypes = ["CERTIFICATES", "STUDIO_GALLERY", "REFERENCES"] as const;
  const availableType = collectionTypes.find(
    (type) => !existingCollections.some((collection) => collection.type === type),
  );
  const collection = availableType
    ? await prisma.mediaCollection.create({ data: { type: availableType } })
    : await prisma.mediaCollection.findFirstOrThrow({ orderBy: { id: "asc" } });
  const createdCollection = Boolean(availableType);
  const lastItem = await prisma.mediaCollectionItem.findFirst({
    where: { collectionId: collection.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const firstSortOrder = (lastItem?.sortOrder ?? -1) + 1;

  try {
    const firstItem = await prisma.mediaCollectionItem.create({
      data: {
        collectionId: collection.id,
        mediaAssetId: firstAsset.id,
        sortOrder: firstSortOrder,
        isVisible: false,
        altText: "Override alt textu",
        caption: "Popisek",
      },
    });
    const secondItem = await prisma.mediaCollectionItem.create({
      data: {
        collectionId: collection.id,
        mediaAssetId: secondAsset.id,
        sortOrder: firstSortOrder + 1,
      },
    });

    const orderedItems = await prisma.mediaCollectionItem.findMany({
      where: { id: { in: [firstItem.id, secondItem.id] } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    assert.deepEqual(orderedItems.map((item) => item.id), [firstItem.id, secondItem.id]);
    assert.equal(orderedItems[0]?.isVisible, false);
    assert.equal(orderedItems[0]?.altText, "Override alt textu");
    assert.equal(orderedItems[0]?.caption, "Popisek");

    await assert.rejects(
      prisma.mediaCollectionItem.create({
        data: {
          collectionId: collection.id,
          mediaAssetId: firstAsset.id,
          sortOrder: firstSortOrder + 2,
        },
      }),
      (error) => isPrismaError(error, "P2002"),
    );
    await assert.rejects(
      prisma.mediaCollectionItem.create({
        data: {
          collectionId: collection.id,
          mediaAssetId: thirdAsset.id,
          sortOrder: firstSortOrder,
        },
      }),
      (error) => isPrismaError(error, "P2002"),
    );
    await assert.rejects(
      prisma.mediaAsset.delete({ where: { id: firstAsset.id } }),
      (error) => isPrismaError(error, "P2003"),
    );
    assert.ok(await prisma.mediaAsset.findUnique({ where: { id: firstAsset.id } }));
    assert.deepEqual(await getMediaAssetUsage(firstAsset.id), {
      isUsed: true,
      references: [{ source: "MediaCollectionItem", recordId: firstItem.id, field: collection.type }],
    });
  } finally {
    await prisma.mediaCollectionItem.deleteMany({
      where: { mediaAssetId: { in: [firstAsset.id, secondAsset.id, thirdAsset.id] } },
    });
    if (createdCollection) {
      await prisma.mediaCollection.deleteMany({ where: { id: collection.id } });
    }
    await prisma.mediaAsset.deleteMany({
      where: { id: { in: [firstAsset.id, secondAsset.id, thirdAsset.id] } },
    });
  }
});

dbTest("smazání MediaAsset nastaví nové singularní SiteSettings vazby na null", async () => {
  const { prisma } = await import("@/lib/prisma");
  const asset = await createAsset();
  const settingsId = `media-library-v2-${randomUUID()}`;

  try {
    await prisma.siteSettings.create({
      data: {
        id: settingsId,
        salonName: "Test",
        addressLine: "Test 1",
        city: "Praha",
        postalCode: "100 00",
        phone: "+420 000 000 000",
        contactEmail: "media-library-v2@example.test",
        notificationAdminEmail: "media-library-v2@example.test",
        emailSenderName: "Test",
        emailSenderEmail: "media-library-v2@example.test",
        contactPhotoMediaId: asset.id,
        homePortraitMediaId: asset.id,
        aboutPortraitMediaId: asset.id,
      },
    });

    await prisma.mediaAsset.delete({ where: { id: asset.id } });

    const settings = await prisma.siteSettings.findUniqueOrThrow({ where: { id: settingsId } });
    assert.equal(settings.contactPhotoMediaId, null);
    assert.equal(settings.homePortraitMediaId, null);
    assert.equal(settings.aboutPortraitMediaId, null);
  } finally {
    await prisma.siteSettings.deleteMany({ where: { id: settingsId } });
    await prisma.mediaAsset.deleteMany({ where: { id: asset.id } });
  }
});
