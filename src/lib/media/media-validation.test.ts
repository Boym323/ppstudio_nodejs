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

async function loadMediaValidation() {
  setTestEnv();
  return import('@/lib/media/media-validation');
}

test('validateMediaFile accepts supported image uploads', async () => {
  const { validateMediaFile } = await loadMediaValidation();
  const file = new File([Buffer.from('fake-image-content')], 'certificate.webp', {
    type: 'image/webp',
  });

  const result = await validateMediaFile(file);

  assert.equal(result.originalFilename, 'certificate.webp');
  assert.equal(result.extension, 'webp');
  assert.equal(result.mimeType, 'image/webp');
  assert.equal(result.sizeBytes, Buffer.byteLength('fake-image-content'));
});

test('validateMediaFile rejects unsupported mime types', async () => {
  const { validateMediaFile } = await loadMediaValidation();
  const file = new File([Buffer.from('pdf')], 'certificate.pdf', {
    type: 'application/pdf',
  });

  await assert.rejects(() => validateMediaFile(file), /MEDIA_FILE_TYPE_UNSUPPORTED/);
});
