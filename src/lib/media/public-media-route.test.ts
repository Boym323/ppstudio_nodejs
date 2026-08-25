import assert from 'node:assert/strict';
import test from 'node:test';

function setTestEnv() {
  process.env.NEXT_PUBLIC_APP_NAME = 'PP Studio';
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/ppstudio_dev?schema=public';
  process.env.ADMIN_SESSION_SECRET = 'test-secret-value-with-at-least-32-chars';
  process.env.ADMIN_OWNER_EMAIL = 'owner@example.com';
  process.env.ADMIN_OWNER_PASSWORD = 'change-me-owner';
  process.env.ADMIN_STAFF_EMAIL = 'staff@example.com';
  process.env.ADMIN_STAFF_PASSWORD = 'change-me-staff';
  process.env.EMAIL_DELIVERY_MODE = 'log';
}

function buildAsset(storagePath: string) {
  return {
    visibility: 'PUBLIC',
    storagePath,
    storedFilename: storagePath.split('/').pop(),
    mimeType: 'image/jpeg',
    size: 3,
    optimizedStoragePath: null,
    optimizedMimeType: null,
    optimizedSize: null,
    thumbnailStoragePath: null,
    thumbnailMimeType: null,
    thumbnailSize: null,
  };
}

async function withRouteMocks(
  storagePath: string,
  run: (get: typeof import('./public-media-route').GET, findFirstCalls: unknown[]) => Promise<void>,
) {
  setTestEnv();
  const [{ GET }, { prisma }, { localMediaStorage }] = await Promise.all([
    import('./public-media-route'),
    import('@/lib/prisma'),
    import('@/lib/media/local-media-storage'),
  ]);
  const originalFindFirst = prisma.mediaAsset.findFirst;
  const originalReadFile = localMediaStorage.readFile;
  const mediaAsset = prisma.mediaAsset as unknown as { findFirst: (...args: unknown[]) => unknown };
  const storage = localMediaStorage as unknown as { readFile: (...args: unknown[]) => unknown };
  const findFirstCalls: unknown[] = [];

  mediaAsset.findFirst = async (args) => {
    findFirstCalls.push(args);
    return buildAsset(storagePath);
  };
  storage.readFile = async () => Buffer.from('jpg');

  try {
    await run(GET, findFirstCalls);
  } finally {
    mediaAsset.findFirst = originalFindFirst as unknown as (...args: unknown[]) => unknown;
    storage.readFile = originalReadFile as unknown as (...args: unknown[]) => unknown;
  }
}

function mediaRequest(kind: string, path: string[]) {
  return {
    params: Promise.resolve({ kind, path }),
  };
}

test('public media route serves new images storage paths without MediaType mapping', async () => {
  const storagePath = 'images/2026/08/a1b2c3d4e5f6-original.jpg';

  await withRouteMocks(storagePath, async (GET, findFirstCalls) => {
    const response = await GET(new Request('https://example.com/media/public/images/2026/08/a1b2c3d4e5f6-original.jpg'), mediaRequest('images', ['2026', '08', 'a1b2c3d4e5f6-original.jpg']));

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'jpg');
    assert.equal(findFirstCalls.length, 1);
  });
});

test('public media route continues to serve legacy storage paths', async () => {
  const storagePath = 'certificates/2026/04/a1b2c3d4e5f6-original.jpg';

  await withRouteMocks(storagePath, async (GET) => {
    const response = await GET(new Request('https://example.com/media/public/certificates/2026/04/a1b2c3d4e5f6-original.jpg'), mediaRequest('certificates', ['2026', '04', 'a1b2c3d4e5f6-original.jpg']));

    assert.equal(response.status, 200);
  });
});

test('public media route rejects unknown roots and path traversal', async () => {
  setTestEnv();
  const { GET } = await import('./public-media-route');

  const unknownRoot = await GET(new Request('https://example.com/media/public/private/2026/08/a1b2c3d4e5f6-original.jpg'), mediaRequest('private', ['2026', '08', 'a1b2c3d4e5f6-original.jpg']));
  const traversal = await GET(new Request('https://example.com/media/public/images/2026/08/a1b2c3d4e5f6-original.jpg'), mediaRequest('images', ['2026', '08', '..', 'a1b2c3d4e5f6-original.jpg']));

  assert.equal(unknownRoot.status, 404);
  assert.equal(traversal.status, 400);
});
