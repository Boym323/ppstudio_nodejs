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

test('getMediaAssetUsage vrátí použití voucherového loga v SiteSettings', async () => {
  setTestEnv();
  const { prisma } = await import('@/lib/prisma');
  const originalFindMany = prisma.siteSettings.findMany;
  const mutableSiteSettings = prisma.siteSettings as unknown as { findMany: (...args: unknown[]) => unknown };

  mutableSiteSettings.findMany = async (args) => {
    assert.deepEqual(args, {
      where: { voucherPdfLogoMediaId: 'media-used' },
      select: { id: true },
    });
    return [{ id: 'site-settings' }];
  };

  try {
    const { getMediaAssetUsage } = await import('./media-asset-usage');
    assert.deepEqual(await getMediaAssetUsage('media-used'), {
      isUsed: true,
      references: [{ source: 'SiteSettings', recordId: 'site-settings', field: 'voucherPdfLogoMediaId' }],
    });
  } finally {
    mutableSiteSettings.findMany = originalFindMany as unknown as (...args: unknown[]) => unknown;
  }
});
