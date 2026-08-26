import 'dotenv/config';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/ppstudio_dev?schema=public';

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === '1' ? test : test.skip;

async function createAsset() {
  const { prisma } = await import('@/lib/prisma');
  const suffix = randomUUID();
  return prisma.mediaAsset.create({ data: { originalFilename: `${suffix}.jpg`, fileName: `${suffix}.jpg`, mimeType: 'image/jpeg', extension: 'jpg', size: 1, storagePath: `test/collection-order/${suffix}.jpg`, url: `/media/public/test/collection-order/${suffix}.jpg` } });
}

for (const type of ['STUDIO_GALLERY', 'CERTIFICATES'] as const) {
  dbTest(`${type} přesouvá membershipy deterministicky a nové zařadí na konec`, async () => {
    const [{ prisma }, { moveMediaCollectionItem, saveMediaCollectionMembership }] = await Promise.all([
      import('@/lib/prisma'), import('./media-collection-order'),
    ]);
    const assets = await Promise.all(Array.from({ length: 4 }, createAsset));

    try {
      const collection = await prisma.mediaCollection.upsert({ where: { type }, create: { type }, update: {} });
      await prisma.mediaCollectionItem.deleteMany({ where: { collectionId: collection.id } });
      for (const asset of assets.slice(0, 3)) {
        await prisma.$transaction((tx) => saveMediaCollectionMembership(tx, collection.id, asset.id, true));
      }
      await prisma.$transaction((tx) => saveMediaCollectionMembership(tx, collection.id, assets[3].id, false));

      const initial = await prisma.mediaCollectionItem.findMany({ where: { collectionId: collection.id }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
      assert.deepEqual(initial.map((item) => item.mediaAssetId), assets.map((asset) => asset.id));
      assert.deepEqual(initial.map((item) => item.sortOrder), [0, 1, 2, 3]);

      await prisma.$transaction((tx) => moveMediaCollectionItem(tx, collection.id, initial[1].id, 'up'));
      await prisma.$transaction((tx) => moveMediaCollectionItem(tx, collection.id, initial[1].id, 'down'));
      await prisma.$transaction((tx) => moveMediaCollectionItem(tx, collection.id, initial[0].id, 'up'));
      await prisma.$transaction((tx) => moveMediaCollectionItem(tx, collection.id, initial[3].id, 'down'));

      const ordered = await prisma.mediaCollectionItem.findMany({ where: { collectionId: collection.id }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
      assert.deepEqual(ordered.map((item) => item.mediaAssetId), assets.map((asset) => asset.id));
      assert.deepEqual(ordered.map((item) => item.sortOrder), [0, 1, 2, 3]);
      assert.equal(new Set(ordered.map((item) => item.sortOrder)).size, ordered.length);
      assert.equal(ordered.at(-1)?.isVisible, false);
    } finally {
      await prisma.mediaCollectionItem.deleteMany({ where: { mediaAssetId: { in: assets.map((asset) => asset.id) } } });
      await prisma.mediaAsset.deleteMany({ where: { id: { in: assets.map((asset) => asset.id) } } });
    }
  });
}
