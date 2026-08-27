import assert from 'node:assert/strict';
import test from 'node:test';

test('picker action odmítne neplatný scope, příliš dlouhé hledání a pageSize', async () => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public';
  process.env.ADMIN_SESSION_SECRET = 'test-secret-value-with-at-least-32-chars';
  process.env.ADMIN_OWNER_EMAIL = 'owner@example.com';
  const { searchMediaPickerAssetsAction } = await import('./media-picker-actions');
  for (const input of [
    { area: 'owner', search: '', page: 1, pageSize: 24, scope: { type: 'COLLECTION', collectionType: 'REFERENCES' } },
    { area: 'owner', search: 'x'.repeat(121), page: 1, pageSize: 24, scope: { type: 'GENERAL', section: 'SETTINGS' } },
    { area: 'owner', search: '', page: 1, pageSize: 25, scope: { type: 'GENERAL', section: 'SETTINGS' } },
  ]) assert.equal((await searchMediaPickerAssetsAction(input as never)).status, 'error');
});
