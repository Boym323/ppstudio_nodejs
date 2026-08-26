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

test('listMediaPage stránkuje první, další i neplatnou poslední stránku stabilně', async () => {
  setTestEnv();
  const { prisma } = await import('@/lib/prisma');
  const originalCount = prisma.mediaAsset.count;
  const originalFindMany = prisma.mediaAsset.findMany;
  const skips: number[] = [];
  const rows = Array.from({ length: 97 }, (_, index) => ({ id: String(index), isPublished: true, url: `/media/${index}`, optimizedUrl: null, thumbnailUrl: null }));
  const mediaAsset = prisma.mediaAsset as unknown as { count: (...args: unknown[]) => unknown; findMany: (...args: unknown[]) => unknown };
  mediaAsset.count = async () => rows.length;
  mediaAsset.findMany = async (rawArgs: unknown) => {
    const { skip, take } = rawArgs as { skip: number; take: number };
    skips.push(skip);
    return rows.slice(skip, skip + take);
  };
  try {
    const { listMediaPage } = await import('./media-library');
    assert.equal((await listMediaPage({ page: 1 })).assets.length, 48);
    assert.equal((await listMediaPage({ page: 2 })).assets[0]?.id, '48');
    const last = await listMediaPage({ page: 999 });
    assert.equal(last.page, 3);
    assert.equal(last.assets.length, 1);
    assert.deepEqual(skips, [0, 48, 96]);
  } finally {
    mediaAsset.count = originalCount as unknown as (...args: unknown[]) => unknown;
    mediaAsset.findMany = originalFindMany as unknown as (...args: unknown[]) => unknown;
  }
});
