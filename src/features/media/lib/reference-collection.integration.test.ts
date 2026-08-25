import 'dotenv/config';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/ppstudio_dev?schema=public';
process.env.NEXT_PUBLIC_APP_URL ??= 'https://example.com';
process.env.ADMIN_SESSION_SECRET ??= 'test-secret-value-with-at-least-32-chars';
process.env.ADMIN_OWNER_EMAIL ??= 'owner@example.com';
process.env.EMAIL_DELIVERY_MODE ??= 'log';

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === '1' ? test : test.skip;

async function createAsset() {
  const { prisma } = await import('@/lib/prisma');
  const suffix = randomUUID();
  return prisma.mediaAsset.create({ data: { kind: 'CONTENT', type: 'GENERAL', originalFilename: `${suffix}.jpg`, fileName: `${suffix}.jpg`, storedFilename: `${suffix}.jpg`, mimeType: 'image/jpeg', extension: 'jpg', sizeBytes: 1, size: 1, storagePath: `test/references/${suffix}.jpg`, url: `/media/public/test/references/${suffix}.jpg` } });
}

dbTest('REFERENCES spravují membership, metadata, pořadí a usage bez smazání assetu', async () => {
  const [{ prisma }, { addReferenceMedia, moveReferenceMedia, removeReferenceMedia, updateReferenceMedia }, { getMediaAssetUsage }] = await Promise.all([
    import('@/lib/prisma'), import('./reference-collection'), import('./media-asset-usage'),
  ]);
  const [first, second] = await Promise.all([createAsset(), createAsset()]);

  try {
    const firstItem = await addReferenceMedia(first.id);
    await addReferenceMedia(first.id);
    assert.equal(await prisma.mediaCollectionItem.count({ where: { mediaAssetId: first.id, collection: { type: 'REFERENCES' } } }), 1);
    assert.deepEqual(await getMediaAssetUsage(first.id), { isUsed: true, references: [{ source: 'MediaCollectionItem', recordId: firstItem.id, field: 'REFERENCES' }] });

    const secondItem = await addReferenceMedia(second.id);
    await updateReferenceMedia(firstItem.id, { isVisible: false, altText: 'Alt reference', caption: 'Popisek reference' });
    await moveReferenceMedia(secondItem.id, 'up');
    const items = await prisma.mediaCollectionItem.findMany({ where: { id: { in: [firstItem.id, secondItem.id] } }, orderBy: { sortOrder: 'asc' } });
    assert.deepEqual(items.map((item) => item.id), [secondItem.id, firstItem.id]);
    assert.deepEqual(items.map((item) => item.sortOrder), [0, 1]);
    const savedFirst = items.find((item) => item.id === firstItem.id)!;
    assert.equal(savedFirst.isVisible, false);
    assert.equal(savedFirst.altText, 'Alt reference');
    assert.equal(savedFirst.caption, 'Popisek reference');

    await removeReferenceMedia(firstItem.id);
    assert.ok(await prisma.mediaAsset.findUnique({ where: { id: first.id } }));
    assert.deepEqual(await getMediaAssetUsage(first.id), { isUsed: false, references: [] });
  } finally {
    await prisma.mediaCollectionItem.deleteMany({ where: { mediaAssetId: { in: [first.id, second.id] } } });
    await prisma.mediaAsset.deleteMany({ where: { id: { in: [first.id, second.id] } } });
  }
});
