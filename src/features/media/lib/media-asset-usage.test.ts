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

test('getMediaAssetUsage vrátí použití v SiteSettings i MediaCollectionItem', async () => {
  setTestEnv();
  const { prisma } = await import('@/lib/prisma');
  const originalFindMany = prisma.siteSettings.findMany;
  const originalCollectionItemFindMany = prisma.mediaCollectionItem.findMany;
  const mutableSiteSettings = prisma.siteSettings as unknown as { findMany: (...args: unknown[]) => unknown };
  const mutableCollectionItems = prisma.mediaCollectionItem as unknown as { findMany: (...args: unknown[]) => unknown };

  mutableSiteSettings.findMany = async (args) => {
    assert.deepEqual(args, {
      where: {
        OR: [
          { voucherPdfLogoMediaId: 'media-used' },
          { contactPhotoMediaId: 'media-used' },
          { homePortraitMediaId: 'media-used' },
          { aboutPortraitMediaId: 'media-used' },
        ],
      },
      select: {
        id: true,
        voucherPdfLogoMediaId: true,
        contactPhotoMediaId: true,
        homePortraitMediaId: true,
        aboutPortraitMediaId: true,
      },
    });
    return [{
      id: 'site-settings',
      voucherPdfLogoMediaId: 'media-used',
      contactPhotoMediaId: 'media-used',
      homePortraitMediaId: 'media-used',
      aboutPortraitMediaId: 'media-used',
    }];
  };
  mutableCollectionItems.findMany = async (args) => {
    assert.deepEqual(args, {
      where: { mediaAssetId: 'media-used' },
      select: { id: true },
    });
    return [{ id: 'collection-item' }];
  };

  try {
    const { getMediaAssetUsage } = await import('./media-asset-usage');
    assert.deepEqual(await getMediaAssetUsage('media-used'), {
      isUsed: true,
      references: [
        { source: 'SiteSettings', recordId: 'site-settings', field: 'voucherPdfLogoMediaId' },
        { source: 'SiteSettings', recordId: 'site-settings', field: 'contactPhotoMediaId' },
        { source: 'SiteSettings', recordId: 'site-settings', field: 'homePortraitMediaId' },
        { source: 'SiteSettings', recordId: 'site-settings', field: 'aboutPortraitMediaId' },
        { source: 'MediaCollectionItem', recordId: 'collection-item', field: 'mediaAssetId' },
      ],
    });
  } finally {
    mutableSiteSettings.findMany = originalFindMany as unknown as (...args: unknown[]) => unknown;
    mutableCollectionItems.findMany = originalCollectionItemFindMany as unknown as (...args: unknown[]) => unknown;
  }
});
