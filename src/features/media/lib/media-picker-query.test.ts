import assert from 'node:assert/strict';
import test from 'node:test';

function setTestEnv() {
  process.env.NEXT_PUBLIC_APP_NAME = 'PP Studio';
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public';
  process.env.ADMIN_SESSION_SECRET = 'test-secret-value-with-at-least-32-chars';
  process.env.ADMIN_OWNER_EMAIL = 'owner@example.com';
  process.env.EMAIL_DELIVERY_MODE = 'log';
}

test('picker query používá public filtr, server search, stabilní pořadí a stránkování', async () => {
  setTestEnv();
  const { prisma } = await import('@/lib/prisma');
  const mediaAsset = prisma.mediaAsset as unknown as { count: (...args: unknown[]) => unknown; findMany: (...args: unknown[]) => unknown };
  const originalCount = prisma.mediaAsset.count;
  const originalFindMany = prisma.mediaAsset.findMany;
  let countArgs: unknown;
  let findArgs: unknown;
  mediaAsset.count = async (args) => { countArgs = args; return 49; };
  mediaAsset.findMany = async (args) => { findArgs = args; return [{ id: 'asset', title: 'Titulek', fileName: 'file.jpg', altText: null, thumbnailUrl: '/thumb', optimizedUrl: '/optimized', url: '/original' }]; };
  try {
    const { searchMediaPickerAssets } = await import('./media-picker-query');
    const result = await searchMediaPickerAssets({ search: 'portrét', page: 2, pageSize: 24, scope: { type: 'GENERAL', section: 'SETTINGS' } });
    const where = (countArgs as { where: Record<string, unknown> }).where;
    assert.deepEqual({ visibility: where.visibility, isPublished: where.isPublished, deletionRequestedAt: where.deletionRequestedAt }, { visibility: 'PUBLIC', isPublished: true, deletionRequestedAt: null });
    assert.equal((where.OR as unknown[]).length, 4);
    assert.deepEqual(findArgs, { where, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], skip: 24, take: 24, select: { id: true, title: true, fileName: true, altText: true, thumbnailUrl: true, optimizedUrl: true, url: true } });
    assert.deepEqual({ page: result.page, pageSize: result.pageSize, total: result.total, pageCount: result.pageCount }, { page: 2, pageSize: 24, total: 49, pageCount: 3 });
  } finally {
    mediaAsset.count = originalCount as unknown as (...args: unknown[]) => unknown;
    mediaAsset.findMany = originalFindMany as unknown as (...args: unknown[]) => unknown;
  }
});

test('picker scopes odvozují exclusions z databázových relations', async () => {
  setTestEnv();
  const { prisma } = await import('@/lib/prisma');
  const mediaAsset = prisma.mediaAsset as unknown as { count: (...args: unknown[]) => unknown; findMany: (...args: unknown[]) => unknown };
  const originalCount = prisma.mediaAsset.count;
  const originalFindMany = prisma.mediaAsset.findMany;
  const wheres: unknown[] = [];
  mediaAsset.count = async (args: unknown) => { wheres.push((args as { where: unknown }).where); return 0; };
  mediaAsset.findMany = async () => [];
  try {
    const { searchMediaPickerAssets } = await import('./media-picker-query');
    await searchMediaPickerAssets({ scope: { type: 'COLLECTION', collectionType: 'STUDIO_GALLERY' } });
    await searchMediaPickerAssets({ scope: { type: 'REFERENCES' } });
    await searchMediaPickerAssets({ scope: { type: 'SERVICE_GALLERY', serviceId: 'cm1234567890123456789012' } });
    assert.deepEqual((wheres[0] as { collectionItems: unknown }).collectionItems, { none: { collection: { type: 'STUDIO_GALLERY' } } });
    assert.deepEqual((wheres[1] as { collectionItems: unknown }).collectionItems, { none: { collection: { type: 'REFERENCES' } } });
    assert.deepEqual((wheres[2] as { serviceMedia: unknown }).serviceMedia, { none: { serviceId: 'cm1234567890123456789012', role: 'GALLERY' } });
  } finally {
    mediaAsset.count = originalCount as unknown as (...args: unknown[]) => unknown;
    mediaAsset.findMany = originalFindMany as unknown as (...args: unknown[]) => unknown;
  }
});
