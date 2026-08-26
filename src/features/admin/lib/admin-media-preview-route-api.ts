import type { AdminArea } from '@/config/navigation';
import { requireAdminSectionAccess } from '@/features/admin/lib/admin-guards';
import { getMediaAssetById } from '@/features/media/lib/media-asset-repository';
import { getMediaStorageAdapter } from '@/lib/media/media-storage';

const privateNoStoreHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

type PreviewAsset = NonNullable<Awaited<ReturnType<typeof getMediaAssetById>>>;

function isAdminArea(value: string): value is AdminArea {
  return value === 'owner' || value === 'salon';
}

function getPreviewVariant(asset: PreviewAsset) {
  if (asset.thumbnailStoragePath && asset.thumbnailMimeType && asset.thumbnailSize) {
    return {
      storagePath: asset.thumbnailStoragePath,
      mimeType: asset.thumbnailMimeType,
      size: asset.thumbnailSize,
    };
  }

  if (asset.optimizedStoragePath && asset.optimizedMimeType && asset.optimizedSize) {
    return {
      storagePath: asset.optimizedStoragePath,
      mimeType: asset.optimizedMimeType,
      size: asset.optimizedSize,
    };
  }

  return {
    storagePath: asset.storagePath,
    mimeType: asset.mimeType,
    size: asset.size,
  };
}

export function createAdminMediaPreviewRouteApi(deps?: {
  requireAdminSectionAccess?: typeof requireAdminSectionAccess;
  getMediaAssetById?: (id: string) => Promise<PreviewAsset | null>;
  readMediaFile?: (asset: PreviewAsset, storagePath: string) => Promise<Buffer>;
}) {
  const requireAdminSectionAccessImpl = deps?.requireAdminSectionAccess ?? requireAdminSectionAccess;
  const getMediaAssetByIdImpl = deps?.getMediaAssetById ?? getMediaAssetById;
  const readMediaFileImpl = deps?.readMediaFile ?? ((asset, storagePath) =>
    getMediaStorageAdapter(asset.storageProvider).readFile(asset.visibility, storagePath));

  return {
    async GET(_request: Request, context: { params: Promise<{ area: string; assetId: string }> }) {
      const { area, assetId } = await context.params;

      if (!isAdminArea(area)) {
        return new Response('Soubor nebyl nalezen.', { status: 404, headers: privateNoStoreHeaders });
      }

      try {
        await requireAdminSectionAccessImpl(area, 'media');
      } catch {
        return new Response('Přístup odepřen.', { status: 403, headers: privateNoStoreHeaders });
      }

      const asset = await getMediaAssetByIdImpl(assetId);
      if (!asset) {
        return new Response('Soubor nebyl nalezen.', { status: 404, headers: privateNoStoreHeaders });
      }

      const variant = getPreviewVariant(asset);

      try {
        const file = await readMediaFileImpl(asset, variant.storagePath);
        return new Response(Uint8Array.from(file), {
          headers: {
            ...privateNoStoreHeaders,
            'Content-Type': variant.mimeType,
            'Content-Length': String(variant.size),
          },
        });
      } catch {
        return new Response('Soubor nebyl nalezen.', { status: 404, headers: privateNoStoreHeaders });
      }
    },
  };
}
