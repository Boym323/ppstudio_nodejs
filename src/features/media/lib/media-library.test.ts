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

test('P2003 při delete MediaAsset se rozpozná jako konflikt usage', async () => {
  setTestEnv();
  const { mapMediaAssetDeleteError } = await import('./media-library');
  assert.equal((mapMediaAssetDeleteError({ code: 'P2003' }) as Error).message, 'MEDIA_ASSET_IN_USE');
  const originalError = new Error('MEDIA_ASSET_NOT_FOUND');
  assert.equal(mapMediaAssetDeleteError(originalError), originalError);
});
