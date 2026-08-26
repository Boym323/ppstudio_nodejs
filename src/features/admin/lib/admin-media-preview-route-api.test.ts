import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NEXT_PUBLIC_APP_NAME ??= 'PP Studio';
process.env.NEXT_PUBLIC_APP_URL ??= 'https://example.com';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public';
process.env.ADMIN_SESSION_SECRET ??= 'test-secret-value-with-at-least-32-chars';
process.env.ADMIN_OWNER_EMAIL ??= 'owner@example.com';
process.env.ADMIN_OWNER_PASSWORD ??= 'change-me-owner';
process.env.ADMIN_STAFF_EMAIL ??= 'staff@example.com';
process.env.ADMIN_STAFF_PASSWORD ??= 'change-me-staff';
process.env.EMAIL_DELIVERY_MODE ??= 'log';

async function getPreviewRouteApi() {
  return (await import('./admin-media-preview-route-api')).createAdminMediaPreviewRouteApi;
}

const unpublishedAsset = {
  id: 'cm1234567890123456789012345',
  storageProvider: 'LOCAL',
  visibility: 'PUBLIC',
  storagePath: 'images/2026/08/original.jpg',
  fileName: 'original.jpg',
  mimeType: 'image/jpeg',
  size: 30,
  optimizedStoragePath: 'images/2026/08/optimized.webp',
  optimizedMimeType: 'image/webp',
  optimizedSize: 20,
  thumbnailStoragePath: 'images/2026/08/thumbnail.webp',
  thumbnailMimeType: 'image/webp',
  thumbnailSize: 10,
} as never;

function previewContext(area = 'owner', assetId = 'cm1234567890123456789012345') {
  return { params: Promise.resolve({ area, assetId }) };
}

test('admin preview zpřístupní nepublikovaný asset autorizovanému uživateli a preferuje thumbnail', async () => {
  const createAdminMediaPreviewRouteApi = await getPreviewRouteApi();
  const accessCalls: Array<[string, string]> = [];
  const readPaths: string[] = [];
  const api = createAdminMediaPreviewRouteApi({
    requireAdminSectionAccess: async (area, section) => {
      accessCalls.push([area, section]);
      return {} as never;
    },
    getMediaAssetById: async () => unpublishedAsset,
    readMediaFile: async (_asset, storagePath) => {
      readPaths.push(storagePath);
      return Buffer.from('thumbnail');
    },
  });

  const response = await api.GET(new Request('https://example.com/api/admin/media/owner/cm1234567890123456789012345/preview'), previewContext());

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'thumbnail');
  assert.deepEqual(accessCalls, [['owner', 'media']]);
  assert.deepEqual(readPaths, ['images/2026/08/thumbnail.webp']);
  assert.equal(response.headers.get('content-type'), 'image/webp');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
});

test('admin preview odmítne neautorizovaný požadavek před načtením assetu', async () => {
  const createAdminMediaPreviewRouteApi = await getPreviewRouteApi();
  let assetWasRead = false;
  const api = createAdminMediaPreviewRouteApi({
    requireAdminSectionAccess: async () => { throw new Error('Přístup odepřen.'); },
    getMediaAssetById: async () => {
      assetWasRead = true;
      return unpublishedAsset;
    },
  });

  const response = await api.GET(new Request('https://example.com/api/admin/media/owner/cm1234567890123456789012345/preview'), previewContext());

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(assetWasRead, false);
});

test('admin preview nevrací neexistující ani k mazání označený asset', async () => {
  const createAdminMediaPreviewRouteApi = await getPreviewRouteApi();
  const api = createAdminMediaPreviewRouteApi({
    requireAdminSectionAccess: async () => ({} as never),
    getMediaAssetById: async () => null,
  });

  const response = await api.GET(new Request('https://example.com/api/admin/media/owner/cm1234567890123456789012345/preview'), previewContext());

  assert.equal(response.status, 404);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});
