import assert from 'node:assert/strict';
import test from 'node:test';

test('nové uploady používají neutrální images/YYYY/MM storagePath', async () => {
  process.env.NEXT_PUBLIC_APP_NAME = 'PP Studio';
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/ppstudio_dev?schema=public';
  process.env.ADMIN_SESSION_SECRET = 'test-secret-value-with-at-least-32-chars';
  process.env.ADMIN_OWNER_EMAIL = 'owner@example.com';
  process.env.EMAIL_DELIVERY_MODE = 'log';
  const { buildMediaStoragePath } = await import('./media-config');
  assert.equal(buildMediaStoragePath({ storedFilename: 'asset.jpg', createdAt: new Date('2026-08-25T12:00:00Z') }), 'images/2026/08/asset.jpg');
});
