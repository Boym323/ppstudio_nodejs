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

test('canonical and legacy public media routes share one GET handler', async () => {
  const [canonicalRoute, legacyRoute, handler] = await Promise.all([
    import('./public/[kind]/[[...path]]/route'),
    import('./[kind]/[[...path]]/route'),
    import('@/lib/media/public-media-route'),
  ]);

  assert.equal(canonicalRoute.GET, handler.GET);
  assert.equal(legacyRoute.GET, handler.GET);
});
