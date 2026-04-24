import assert from 'node:assert/strict';
import test from 'node:test';

function setTestEnv() {
  process.env.NEXT_PUBLIC_APP_NAME = 'PP Studio';
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public';
  process.env.ADMIN_SESSION_SECRET = 'test-secret-value-with-at-least-32-chars';
  process.env.ADMIN_OWNER_EMAIL = 'owner@example.com';
  process.env.ADMIN_OWNER_PASSWORD = 'change-me-owner';
  process.env.ADMIN_STAFF_EMAIL = 'staff@example.com';
  process.env.ADMIN_STAFF_PASSWORD = 'change-me-staff';
  process.env.EMAIL_DELIVERY_MODE = 'log';
}

async function loadMediaFilenameHelpers() {
  setTestEnv();
  return import('@/lib/media/media-filename');
}

async function loadMediaPathHelpers() {
  setTestEnv();
  return import('@/lib/media/media-path');
}

test('buildStoredFilename creates a safe unique filename', async () => {
  const { buildStoredFilename } = await loadMediaFilenameHelpers();
  const storedFilename = buildStoredFilename('jpg');

  assert.match(storedFilename, /^[a-f0-9]{12}-original\.jpg$/);
});

test('buildVariantStoredFilename appends a stable variant suffix', async () => {
  const { buildVariantStoredFilename } = await loadMediaFilenameHelpers();

  assert.equal(
    buildVariantStoredFilename('a1b2c3d4e5f6-original.jpg', 'thumbnail', 'jpg'),
    'a1b2c3d4e5f6-thumbnail.jpg',
  );
});

test('assertSafeStoragePath accepts expected media layout', async () => {
  const { assertSafeStoragePath } = await loadMediaPathHelpers();

  assert.deepEqual(
    assertSafeStoragePath('certificates/2026/04/a1b2c3d4e5f6-original.jpg'),
    ['certificates', '2026', '04', 'a1b2c3d4e5f6-original.jpg'],
  );
});

test('assertSafeStoragePath rejects traversal attempts', async () => {
  const { assertSafeStoragePath } = await loadMediaPathHelpers();

  assert.throws(() => assertSafeStoragePath('../certificates/2026/04/bad.jpg'));
  assert.throws(() => assertSafeStoragePath('certificates/2026/04/../../bad.jpg'));
});
