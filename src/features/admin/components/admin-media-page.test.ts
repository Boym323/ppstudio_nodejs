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

test('Media Library odděluje správu souborů a umístění na webu', async () => {
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
    const published = await AdminMediaPage({ area: 'owner', searchParams: { collection: 'CERTIFICATES' } });
    await AdminMediaPage({ area: 'owner', searchParams: { publication: 'HIDDEN' } });
    const library = await AdminMediaPage({ area: 'owner', searchParams: { q: 'cert', usage: 'UNUSED', publication: 'HIDDEN', page: '2' } });

    assert.deepEqual(wheres.map((where) => (where as { isPublished?: boolean }).isPublished), [false, false]);
    assert.deepEqual(wheres[0], {
      deletionRequestedAt: null,
      isPublished: false,
    });
    assert.deepEqual(groupByCalls, [{ by: ['isPublished'], where: { deletionRequestedAt: null }, _count: { _all: true } }, { by: ['isPublished'], where: { deletionRequestedAt: null }, _count: { _all: true } }, { by: ['isPublished'], where: { deletionRequestedAt: null }, _count: { _all: true } }]);
    assert.deepEqual((published.props as { stats: unknown }).stats, [{ label: 'Souborů celkem', value: '6', tone: 'default' }, { label: 'Publikováno', value: '4', tone: 'accent' }, { label: 'Nepublikováno', value: '2', tone: 'muted' }]);
    assert.ok(findProp(published, 'returnTo').includes('/admin/media?collection=CERTIFICATES'));
    assert.ok(findProp(library, 'href').includes('/admin/media?view=placements'));
    const source = await readFile(new URL('./admin-media-page.tsx', import.meta.url), 'utf8');
    assert.match(source, /if \(canonicalUrl\) redirect\(canonicalUrl\);/);
    assert.match(source, /const search = raw\('q'\)/);
    assert.match(source, /const usageFilter = raw\('usage'\)/);
    assert.match(source, /const publicationFilter = raw\('publication'\)/);
    assert.match(source, /library \? listMediaPage\(\{ page, where, sort \}\)/);
    assert.match(source, /publication: publicationFilter === 'ALL' \? undefined : publicationFilter/);
    assert.match(source, /const returnTo = category \? `\$\{base\}\?collection=\$\{category\}`/);
    assert.match(source, /← Všechna umístění/);
    assert.match(source, /collectionType=\{category\}/);
    assert.match(source, /mediaLocations\.map/);
    assert.match(source, /collection=SERVICE_MEDIA/);
    assert.ok(!findProp(published, 'placeholder').includes('Název, soubor, služba nebo umístění'));
    assert.ok(findProp(library, 'placeholder').some((value) => typeof value === 'string' && value.startsWith('Název, soubor, služba nebo umístění')));
  } finally {
    mediaAsset.count = original.count;
    mediaAsset.findMany = original.findMany;
    mediaAsset.groupBy = original.groupBy;
    collectionItem.findMany = original.collectionFindMany;
  }
});

test('Media Library zachovává náhled certifikátů a přístupné stránkování', async () => {
  const pageSource = await readFile(new URL('./admin-media-page.tsx', import.meta.url), 'utf8');
  const dialogSource = await readFile(new URL('./media-asset-detail-dialog.tsx', import.meta.url), 'utf8');

  assert.match(dialogSource, /memberships\.some\(\(membership\) => membership\.type === 'CERTIFICATES'\)/);
  assert.match(dialogSource, /isDocumentStyle \? 'object-contain' : 'object-cover'/);
  assert.match(pageSource, /<PaginationControl href=\{href\(\{ page: String\(mediaPage.page - 1\) \}\)\} disabled=\{mediaPage.page <= 1\}>Předchozí<\/PaginationControl>/);
  assert.match(pageSource, /<PaginationControl href=\{href\(\{ page: String\(mediaPage.page \+ 1\) \}\)\} disabled=\{mediaPage.page >= mediaPage.pageCount\}>Další<\/PaginationControl>/);
  assert.match(pageSource, /return disabled \? <span aria-disabled=\"true\" className=\{`\$\{linkClass\} opacity-40`\}>\{children\}<\/span> : <Link href=\{href\} className=\{linkClass\}>\{children\}<\/Link>/);
  assert.doesNotMatch(pageSource, /aria-disabled=\{displayPage/);
});
