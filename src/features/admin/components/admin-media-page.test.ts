import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

function setTestEnv() {
  process.env.NEXT_PUBLIC_APP_NAME = 'PP Studio';
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public';
  process.env.ADMIN_SESSION_SECRET = 'test-secret-value-with-at-least-32-chars';
  process.env.ADMIN_OWNER_EMAIL = 'owner@example.com';
  process.env.EMAIL_DELIVERY_MODE = 'log';
}

function findProp(value: unknown, name: string): unknown[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap((item) => findProp(item, name));
  const node = value as { props?: Record<string, unknown> };
  return [...(node.props && name in node.props ? [node.props[name]] : []), ...findProp(node.props?.children, name)];
}

test('Media Library filtruje publikaci, zachová ji v URL a statistiky počítá jen z aktivních assetů', async () => {
  setTestEnv();
  const { prisma } = await import('@/lib/prisma');
  const mediaAsset = prisma.mediaAsset as unknown as {
    count: (...args: unknown[]) => unknown;
    findMany: (...args: unknown[]) => unknown;
    groupBy: (...args: unknown[]) => unknown;
  };
  const collectionItem = prisma.mediaCollectionItem as unknown as { findMany: (...args: unknown[]) => unknown };
  const original = { count: mediaAsset.count, findMany: mediaAsset.findMany, groupBy: mediaAsset.groupBy, collectionFindMany: collectionItem.findMany };
  const wheres: unknown[] = [];
  const groupByCalls: unknown[] = [];
  mediaAsset.count = async (...args: unknown[]) => { wheres.push((args[0] as { where: unknown }).where); return 0; };
  mediaAsset.findMany = async () => [];
  mediaAsset.groupBy = async (args: unknown) => { groupByCalls.push(args); return [{ isPublished: true, _count: { _all: 4 } }, { isPublished: false, _count: { _all: 2 } }]; };
  collectionItem.findMany = async () => [];

  try {
    const { AdminMediaPage } = await import('./admin-media-page');
    const published = await AdminMediaPage({ area: 'owner', searchParams: { q: 'cert', usage: 'UNUSED', collection: 'CERTIFICATES', publication: 'PUBLISHED', page: '2' } });
    await AdminMediaPage({ area: 'owner', searchParams: { publication: 'HIDDEN' } });
    await AdminMediaPage({ area: 'owner', searchParams: {} });

    assert.deepEqual(wheres.map((where) => (where as { isPublished?: boolean }).isPublished), [true, false, undefined]);
    assert.deepEqual(wheres[0], {
      deletionRequestedAt: null,
      OR: [{ title: { contains: 'cert', mode: 'insensitive' } }, { fileName: { contains: 'cert', mode: 'insensitive' } }, { originalFilename: { contains: 'cert', mode: 'insensitive' } }, { altText: { contains: 'cert', mode: 'insensitive' } }],
      NOT: { OR: [{ voucherPdfLogoSettings: { some: {} } }, { contactPhotoSettings: { some: {} } }, { homePortraitSettings: { some: {} } }, { aboutPortraitSettings: { some: {} } }, { collectionItems: { some: {} } }, { serviceMedia: { some: {} } }] },
      isPublished: true,
      collectionItems: { some: { collection: { type: 'CERTIFICATES' } } },
    });
    assert.deepEqual(groupByCalls, [{ by: ['isPublished'], where: { deletionRequestedAt: null }, _count: { _all: true } }, { by: ['isPublished'], where: { deletionRequestedAt: null }, _count: { _all: true } }, { by: ['isPublished'], where: { deletionRequestedAt: null }, _count: { _all: true } }]);
    assert.deepEqual((published.props as { stats: unknown }).stats, [{ label: 'Celkem', value: '6', tone: 'default' }, { label: 'Publikováno', value: '4', tone: 'accent' }, { label: 'Skryto', value: '2', tone: 'muted' }]);
    assert.ok(findProp(published, 'href').includes('/admin/media?q=cert&usage=UNUSED&publication=PUBLISHED&collection=CERTIFICATES'));
    const source = await readFile(new URL('./admin-media-page.tsx', import.meta.url), 'utf8');
    assert.match(source, /publication: publicationFilter === 'ALL' \? undefined : publicationFilter/);
    assert.match(source, /name="publication" value=\{publicationFilter === 'ALL' \? '' : publicationFilter\}/);
    assert.match(source, /const returnTo = href\(\{ page: displayPage > 1 \? String\(displayPage\) : undefined \}\)/);
    assert.ok(findProp(published, 'value').includes('PUBLISHED'));
  } finally {
    mediaAsset.count = original.count;
    mediaAsset.findMany = original.findMany;
    mediaAsset.groupBy = original.groupBy;
    collectionItem.findMany = original.collectionFindMany;
  }
});
