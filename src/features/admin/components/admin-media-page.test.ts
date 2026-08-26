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

test('Media Library filtruje publikaci mimo collection view, kde Studio ignoruje ostatní filtry', async () => {
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

    assert.deepEqual(wheres.map((where) => (where as { isPublished?: boolean }).isPublished), [false, undefined]);
    assert.deepEqual(wheres[0], {
      deletionRequestedAt: null,
      isPublished: false,
    });
    assert.deepEqual(groupByCalls, [{ by: ['isPublished'], where: { deletionRequestedAt: null }, _count: { _all: true } }, { by: ['isPublished'], where: { deletionRequestedAt: null }, _count: { _all: true } }, { by: ['isPublished'], where: { deletionRequestedAt: null }, _count: { _all: true } }]);
    assert.deepEqual((published.props as { stats: unknown }).stats, [{ label: 'Celkem', value: '6', tone: 'default' }, { label: 'Publikováno', value: '4', tone: 'accent' }, { label: 'Skryto', value: '2', tone: 'muted' }]);
    assert.ok(findProp(published, 'href').includes('/admin/media?collection=CERTIFICATES'));
    const source = await readFile(new URL('./admin-media-page.tsx', import.meta.url), 'utf8');
    assert.match(source, /const search = managedCollection \? '' : raw\('q'\)/);
    assert.match(source, /const usageFilter = managedCollection \? 'ALL'/);
    assert.match(source, /const publicationFilter = managedCollection \? 'ALL'/);
    assert.match(source, /libraryAssets\.filter\(\(asset\) => !managedCollectionItems\.some\(\(item\) => item\.mediaAssetId === asset\.id\)\)/);
    assert.match(source, /publication: publicationFilter === 'ALL' \? undefined : publicationFilter/);
    assert.match(source, /name="publication" value=\{publicationFilter === 'ALL' \? '' : publicationFilter\}/);
    assert.match(source, /const returnTo = href\(\{ page: displayPage > 1 \? String\(displayPage\) : undefined \}\)/);
    assert.ok(!findProp(published, 'value').includes('PUBLISHED'));
  } finally {
    mediaAsset.count = original.count;
    mediaAsset.findMany = original.findMany;
    mediaAsset.groupBy = original.groupBy;
    collectionItem.findMany = original.collectionFindMany;
  }
});

test('Media Library používá document preview pro certifikáty a neinteraktivní disabled pagination', async () => {
  const pageSource = await readFile(new URL('./admin-media-page.tsx', import.meta.url), 'utf8');
  const dialogSource = await readFile(new URL('./media-asset-detail-dialog.tsx', import.meta.url), 'utf8');

  assert.match(dialogSource, /memberships\.some\(\(membership\) => membership\.type === 'CERTIFICATES'\)/);
  assert.match(dialogSource, /isDocumentStyle \? 'object-contain' : 'object-cover'/);
  assert.match(pageSource, /<PaginationControl href=\{href\(\{ page: displayPage > 1 \? String\(displayPage - 1\) : undefined \}\)\} disabled=\{displayPage <= 1\}>Předchozí<\/PaginationControl>/);
  assert.match(pageSource, /<PaginationControl href=\{href\(\{ page: displayPage < pageCount \? String\(displayPage \+ 1\) : undefined \}\)\} disabled=\{displayPage >= pageCount\}>Další<\/PaginationControl>/);
  assert.match(pageSource, /return disabled \? <span className=\{className\}>\{children\}<\/span> : <Link href=\{href\} className=\{className\}>\{children\}<\/Link>/);
  assert.doesNotMatch(pageSource, /aria-disabled=\{displayPage/);
});
