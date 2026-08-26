import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { MediaAssetVisibility, MediaCollectionType, MediaStorageProvider } from '@/generated/prisma/browser';

process.env.NEXT_PUBLIC_APP_NAME ??= 'PP Studio';
process.env.NEXT_PUBLIC_APP_URL ??= 'https://example.com';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/ppstudio_dev?schema=public';
process.env.ADMIN_SESSION_SECRET ??= 'test-secret-value-with-at-least-32-chars';
process.env.ADMIN_OWNER_EMAIL ??= 'owner@example.com';
process.env.EMAIL_DELIVERY_MODE ??= 'log';

function buildAsset(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    storageProvider: MediaStorageProvider.LOCAL,
    title: `Titulek ${id}`,
    altText: `Alt ${id}`,
    url: `/media/public/${id}-original.jpg`,
    optimizedUrl: `/media/public/${id}-optimized.jpg`,
    width: 1200,
    height: 900,
    optimizedWidth: 900,
    optimizedHeight: 675,
    storagePath: `${id}-original.jpg`,
    optimizedStoragePath: `${id}-optimized.jpg`,
    visibility: MediaAssetVisibility.PUBLIC,
    isPublished: true,
    deletionRequestedAt: null,
    ...overrides,
  };
}

function expectedCollectionQuery(type: MediaCollectionType) {
  return {
    where: {
      collection: { type },
      isVisible: true,
      mediaAsset: {
        is: {
          isPublished: true,
          visibility: MediaAssetVisibility.PUBLIC,
          deletionRequestedAt: null,
        },
      },
    },
    include: { mediaAsset: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  };
}

test('certifikáty čte z visible a publikovaných membershipů kolekce v jejich pořadí', async () => {
  const { prisma } = await import('@/lib/prisma');
  const originalFindMany = prisma.mediaCollectionItem.findMany;
  const mutableItems = prisma.mediaCollectionItem as unknown as { findMany: (...args: unknown[]) => unknown };

  mutableItems.findMany = async (args) => {
    assert.deepEqual(args, expectedCollectionQuery(MediaCollectionType.CERTIFICATES));
    return [
      { id: 'membership-1', sortOrder: 0, altText: 'Alt z membershipu', mediaAsset: buildAsset('certificate-1') },
      { id: 'membership-2', sortOrder: 1, altText: null, mediaAsset: buildAsset('certificate-2') },
    ];
  };

  try {
    const { getPublicCertificates } = await import('./public-certificates');
    const certificates = await getPublicCertificates();

    assert.deepEqual(certificates.map(({ id }) => id), ['certificate-1', 'certificate-2']);
    assert.equal(certificates[0].alt, 'Alt z membershipu');
    assert.equal(certificates[1].imageUrl, '/media/public/certificate-2-optimized.jpg');
  } finally {
    mutableItems.findMany = originalFindMany as unknown as (...args: unknown[]) => unknown;
  }
});

test('studio galerie respektuje isVisible, isPublished a membership sortOrder', async () => {
  const [{ prisma }, { localMediaStorage }] = await Promise.all([
    import('@/lib/prisma'),
    import('@/lib/media/local-media-storage'),
  ]);
  const originalFindMany = prisma.mediaCollectionItem.findMany;
  const originalFileExists = localMediaStorage.fileExists;
  const mutableItems = prisma.mediaCollectionItem as unknown as { findMany: (...args: unknown[]) => unknown };
  const mutableStorage = localMediaStorage as unknown as { fileExists: (...args: unknown[]) => unknown };

  mutableItems.findMany = async (args) => {
    assert.deepEqual(args, expectedCollectionQuery(MediaCollectionType.STUDIO_GALLERY));
    return [
      { id: 'membership-a', sortOrder: 3, altText: null, mediaAsset: buildAsset('studio-a') },
      { id: 'membership-b', sortOrder: 8, altText: 'Galerie B', mediaAsset: buildAsset('studio-b') },
    ];
  };
  mutableStorage.fileExists = async () => true;

  try {
    const { getPublicStudioPhotos } = await import('./public-studio-photos');
    const photos = await getPublicStudioPhotos();

    assert.deepEqual(photos.map(({ id }) => id), ['studio-a', 'studio-b']);
    assert.equal(photos[1].altText, 'Galerie B');
  } finally {
    mutableItems.findMany = originalFindMany as unknown as (...args: unknown[]) => unknown;
    mutableStorage.fileExists = originalFileExists as unknown as (...args: unknown[]) => unknown;
  }
});

test('singulární veřejná média používají odpovídající SiteSettings relation', async () => {
  const { prisma } = await import('@/lib/prisma');
  const originalFindUnique = prisma.siteSettings.findUnique;
  const mutableSettings = prisma.siteSettings as unknown as { findUnique: (...args: unknown[]) => unknown };

  mutableSettings.findUnique = async (args) => {
    assert.deepEqual(args, {
      where: { id: 'site-settings' },
      select: {
        contactPhotoMedia: true,
        homePortraitMedia: true,
        aboutPortraitMedia: true,
      },
    });
    return {
      contactPhotoMedia: buildAsset('contact'),
      homePortraitMedia: buildAsset('home'),
      aboutPortraitMedia: buildAsset('about'),
    };
  };

  try {
    const {
      getPublicAboutPortraitAsset,
      getPublicContactPhotoAsset,
      getPublicHomePortraitAsset,
    } = await import('./public-media-relations');

    assert.equal((await getPublicContactPhotoAsset())?.id, 'contact');
    assert.equal((await getPublicHomePortraitAsset())?.id, 'home');
    assert.equal((await getPublicAboutPortraitAsset())?.id, 'about');
  } finally {
    mutableSettings.findUnique = originalFindUnique as unknown as (...args: unknown[]) => unknown;
  }
});

test('prázdná nebo nezpůsobilá singulární role bezpečně vrátí null', async () => {
  const { prisma } = await import('@/lib/prisma');
  const originalFindUnique = prisma.siteSettings.findUnique;
  const mutableSettings = prisma.siteSettings as unknown as { findUnique: (...args: unknown[]) => unknown };

  mutableSettings.findUnique = async () => ({
    contactPhotoMedia: null,
    homePortraitMedia: buildAsset('hidden-home', { isPublished: false }),
    aboutPortraitMedia: null,
  });

  try {
    const {
      getPublicAboutPortraitAsset,
      getPublicContactPhotoAsset,
      getPublicHomePortraitAsset,
    } = await import('./public-media-relations');

    assert.equal(await getPublicContactPhotoAsset(), null);
    assert.equal(await getPublicHomePortraitAsset(), null);
    assert.equal(await getPublicAboutPortraitAsset(), null);
  } finally {
    mutableSettings.findUnique = originalFindUnique as unknown as (...args: unknown[]) => unknown;
  }
});

test('veřejné query přepnutých použití nezávisí na legacy MediaType', async () => {
  const sources = await Promise.all([
    readFile(new URL('./public-certificates.ts', import.meta.url), 'utf8'),
    readFile(new URL('./public-media.ts', import.meta.url), 'utf8'),
    readFile(new URL('./public-studio-photos.ts', import.meta.url), 'utf8'),
    readFile(new URL('./public-media-relations.ts', import.meta.url), 'utf8'),
  ]);

  for (const source of sources) {
    assert.doesNotMatch(source, /\bMediaType\b/);
  }
});
