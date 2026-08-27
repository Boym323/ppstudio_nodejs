import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/ppstudio_dev?schema=public';
const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === '1' ? test : test.skip;

dbTest('picker query filtruje eligibility a databázové exclusions všech relation scopes', async () => {
  const [{ prisma }, { searchMediaPickerAssets }] = await Promise.all([import('@/lib/prisma'), import('./media-picker-query')]);
  const token = `picker-${randomUUID()}`;
  const category = await prisma.serviceCategory.create({ data: { name: token, slug: token } });
  const service = await prisma.service.create({ data: { categoryId: category.id, name: token, slug: token, durationMinutes: 30 } });
  const createAsset = (name: string, extra: { isPublished?: boolean; visibility?: 'PUBLIC' | 'PRIVATE'; deletionRequestedAt?: Date } = {}) => prisma.mediaAsset.create({ data: { title: `${token}-${name}`, originalFilename: `${name}.jpg`, fileName: `${token}-${name}.jpg`, mimeType: 'image/jpeg', extension: 'jpg', size: 1, storagePath: `test/${token}/${name}.jpg`, url: `/media/public/test/${token}/${name}.jpg`, ...extra } });
  const assets = await Promise.all([createAsset('available'), createAsset('collection'), createAsset('reference'), createAsset('gallery'), createAsset('hidden', { isPublished: false }), createAsset('private', { visibility: 'PRIVATE' }), createAsset('deleting', { deletionRequestedAt: new Date() })]);
  try {
    const studio = await prisma.mediaCollection.upsert({ where: { type: 'STUDIO_GALLERY' }, create: { type: 'STUDIO_GALLERY' }, update: {} });
    const references = await prisma.mediaCollection.upsert({ where: { type: 'REFERENCES' }, create: { type: 'REFERENCES' }, update: {} });
    const testOrder = 1_500_000_000 + Math.floor(Math.random() * 100_000_000);
    await prisma.mediaCollectionItem.createMany({ data: [{ collectionId: studio.id, mediaAssetId: assets[1].id, sortOrder: testOrder }, { collectionId: references.id, mediaAssetId: assets[2].id, sortOrder: testOrder }] });
    await prisma.serviceMedia.create({ data: { serviceId: service.id, mediaAssetId: assets[3].id, role: 'GALLERY', sortOrder: 0 } });

    const general = await searchMediaPickerAssets({ search: token, scope: { type: 'GENERAL', section: 'SERVICES' }, pageSize: 2 });
    assert.equal(general.total, 4);
    assert.equal(general.items.length, 2);
    const collection = await searchMediaPickerAssets({ search: token, scope: { type: 'COLLECTION', collectionType: 'STUDIO_GALLERY' } });
    const reference = await searchMediaPickerAssets({ search: token, scope: { type: 'REFERENCES' } });
    const gallery = await searchMediaPickerAssets({ search: token, scope: { type: 'SERVICE_GALLERY', serviceId: service.id } });
    assert.ok(!collection.items.some((item) => item.id === assets[1].id));
    assert.ok(!reference.items.some((item) => item.id === assets[2].id));
    assert.ok(!gallery.items.some((item) => item.id === assets[3].id));
  } finally {
    await prisma.service.delete({ where: { id: service.id } });
    await prisma.mediaCollectionItem.deleteMany({ where: { mediaAssetId: { in: assets.map((asset) => asset.id) } } });
    await prisma.mediaAsset.deleteMany({ where: { id: { in: assets.map((asset) => asset.id) } } });
    await prisma.serviceCategory.delete({ where: { id: category.id } });
  }
});
