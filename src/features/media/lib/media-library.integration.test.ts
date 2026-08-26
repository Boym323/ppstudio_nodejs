import 'dotenv/config';

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public';
process.env.NEXT_PUBLIC_APP_URL ??= 'https://example.com';
process.env.ADMIN_SESSION_SECRET ??= 'test-secret-value-with-at-least-32-chars';
process.env.ADMIN_OWNER_EMAIL ??= 'owner@example.com';
process.env.EMAIL_DELIVERY_MODE ??= 'log';

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === '1' ? test : test.skip;

dbTest('použitý asset nelze smazat a neúspěšný replace zachová původní ID', async () => {
  const storageRoot = await mkdtemp(join(tmpdir(), 'ppstudio-media-library-'));
  process.env.MEDIA_STORAGE_ROOT = storageRoot;
  const [{ prisma }, { ensureSiteSettings }, { createMedia, deleteMedia, replaceMediaAsset }] = await Promise.all([
    import('@/lib/prisma'),
    import('@/lib/site-settings'),
    import('./media-library'),
  ]);
  const settings = await ensureSiteSettings();
  const onePixelPng = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const asset = await createMedia({
    file: new File([onePixelPng], 'asset.png', { type: 'image/png' }),
  });

  try {
    await prisma.siteSettings.update({
      where: { id: settings.id },
      data: { voucherPdfLogoMediaId: asset.id },
    });
    await assert.rejects(() => deleteMedia(asset.id), { message: 'MEDIA_ASSET_IN_USE' });
    assert.ok(await prisma.mediaAsset.findUnique({ where: { id: asset.id } }));

    await assert.rejects(() => replaceMediaAsset(asset.id, {
      file: new File([Buffer.from('neplatný soubor')], 'asset.txt', { type: 'text/plain' }),
    }), { message: 'MEDIA_FILE_TYPE_UNSUPPORTED' });
    const afterFailedReplace = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
    assert.equal(afterFailedReplace.id, asset.id);
    assert.equal(afterFailedReplace.storagePath, asset.storagePath);

    const replacementPng = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#000000' } }).png().toBuffer();
    const replaced = await replaceMediaAsset(asset.id, {
      file: new File([replacementPng], 'replacement.png', { type: 'image/png' }),
    });
    assert.equal(replaced.id, asset.id);
    assert.notEqual(replaced.storagePath, asset.storagePath);
    assert.equal((await prisma.siteSettings.findUniqueOrThrow({ where: { id: settings.id } })).voucherPdfLogoMediaId, asset.id);
  } finally {
    await prisma.siteSettings.update({ where: { id: settings.id }, data: { voucherPdfLogoMediaId: null } });
    await prisma.mediaAsset.deleteMany({ where: { id: asset.id } });
    await rm(storageRoot, { recursive: true, force: true });
  }
});
