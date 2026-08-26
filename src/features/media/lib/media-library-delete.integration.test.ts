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

async function createTestAsset() {
  const { createMedia } = await import('./media-library');
  const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#ffffff' } }).png().toBuffer();
  return createMedia({ file: new File([png], 'asset.png', { type: 'image/png' }) });
}

async function withStorageRoot(run: () => Promise<void>) {
  const storageRoot = await mkdtemp(join(tmpdir(), 'ppstudio-media-delete-'));
  process.env.MEDIA_STORAGE_ROOT = storageRoot;
  try {
    await run();
  } finally {
    await rm(storageRoot, { recursive: true, force: true });
  }
}

dbTest('nepoužívaný asset smaže DB záznam před filesystem cleanupem', async () => {
  await withStorageRoot(async () => {
    const [{ prisma }, { localMediaStorage }, { deleteMedia }] = await Promise.all([
      import('@/lib/prisma'),
      import('@/lib/media/local-media-storage'),
      import('./media-library'),
    ]);
    const asset = await createTestAsset();
    const originalDeleteFile = localMediaStorage.deleteFile.bind(localMediaStorage);
    const deletedPaths: string[] = [];
    localMediaStorage.deleteFile = async (file) => {
      assert.equal(await prisma.mediaAsset.findUnique({ where: { id: asset.id } }), null);
      deletedPaths.push(file.storagePath);
      await originalDeleteFile(file);
    };

    try {
      await deleteMedia(asset.id);
      assert.equal(await prisma.mediaAsset.findUnique({ where: { id: asset.id } }), null);
      assert.deepEqual(deletedPaths.sort(), [asset.storagePath, asset.optimizedStoragePath, asset.thumbnailStoragePath].filter(Boolean).sort());
    } finally {
      localMediaStorage.deleteFile = originalDeleteFile;
      await prisma.mediaAsset.deleteMany({ where: { id: asset.id } });
    }
  });
});

dbTest('používaný asset vrátí MEDIA_ASSET_IN_USE bez filesystem cleanupu', async () => {
  await withStorageRoot(async () => {
    const [{ prisma }, { ensureSiteSettings }, { localMediaStorage }, { deleteMedia }] = await Promise.all([
      import('@/lib/prisma'),
      import('@/lib/site-settings'),
      import('@/lib/media/local-media-storage'),
      import('./media-library'),
    ]);
    const settings = await ensureSiteSettings();
    const asset = await createTestAsset();
    const originalDeleteFile = localMediaStorage.deleteFile.bind(localMediaStorage);
    let filesystemCleanupCalled = false;
    localMediaStorage.deleteFile = async (file) => {
      filesystemCleanupCalled = true;
      await originalDeleteFile(file);
    };

    try {
      await prisma.siteSettings.update({ where: { id: settings.id }, data: { voucherPdfLogoMediaId: asset.id } });
      await assert.rejects(() => deleteMedia(asset.id), { message: 'MEDIA_ASSET_IN_USE' });
      assert.equal(filesystemCleanupCalled, false);
      assert.ok(await prisma.mediaAsset.findUnique({ where: { id: asset.id } }));
    } finally {
      localMediaStorage.deleteFile = originalDeleteFile;
      await prisma.siteSettings.update({ where: { id: settings.id }, data: { voucherPdfLogoMediaId: null } });
      await prisma.mediaAsset.deleteMany({ where: { id: asset.id } });
    }
  });
});

dbTest('po odstranění vazby lze asset korektně smazat', async () => {
  await withStorageRoot(async () => {
    const [{ prisma }, { ensureSiteSettings }, { deleteMedia }] = await Promise.all([
      import('@/lib/prisma'),
      import('@/lib/site-settings'),
      import('./media-library'),
    ]);
    const settings = await ensureSiteSettings();
    const asset = await createTestAsset();

    try {
      await prisma.siteSettings.update({ where: { id: settings.id }, data: { voucherPdfLogoMediaId: asset.id } });
      await assert.rejects(() => deleteMedia(asset.id), { message: 'MEDIA_ASSET_IN_USE' });
      await prisma.siteSettings.update({ where: { id: settings.id }, data: { voucherPdfLogoMediaId: null } });
      await deleteMedia(asset.id);
      assert.equal(await prisma.mediaAsset.findUnique({ where: { id: asset.id } }), null);
    } finally {
      await prisma.siteSettings.update({ where: { id: settings.id }, data: { voucherPdfLogoMediaId: null } });
      await prisma.mediaAsset.deleteMany({ where: { id: asset.id } });
    }
  });
});

dbTest('selhání filesystem cleanupu po DB delete neobnoví asset', async () => {
  await withStorageRoot(async () => {
    const [{ prisma }, { localMediaStorage }, { deleteMedia }] = await Promise.all([
      import('@/lib/prisma'),
      import('@/lib/media/local-media-storage'),
      import('./media-library'),
    ]);
    const asset = await createTestAsset();
    const originalDeleteFile = localMediaStorage.deleteFile.bind(localMediaStorage);
    const originalConsoleError = console.error;
    const logs: unknown[][] = [];
    localMediaStorage.deleteFile = async () => { throw new Error('filesystem unavailable'); };
    console.error = (...args: unknown[]) => { logs.push(args); };

    try {
      await deleteMedia(asset.id);
      assert.equal(await prisma.mediaAsset.findUnique({ where: { id: asset.id } }), null);
      assert.equal(logs.length, 1);
      assert.equal(logs[0]?.[0], 'Media asset filesystem cleanup failed after database deletion');
    } finally {
      localMediaStorage.deleteFile = originalDeleteFile;
      console.error = originalConsoleError;
      await prisma.mediaAsset.deleteMany({ where: { id: asset.id } });
    }
  });
});
