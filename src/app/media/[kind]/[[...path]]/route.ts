import { MediaType } from '@prisma/client';
import { NextResponse } from 'next/server';

import { localMediaStorage } from '@/lib/media/local-media-storage';
import { assertSafeStoragePath } from '@/lib/media/media-path';
import { getPublicMediaAssetByPath } from '@/features/media/lib/media-asset-repository';

const publicMediaTypes = new Map<string, MediaType>([
  ['certificates', MediaType.CERTIFICATE],
  ['spaces', MediaType.SALON_PHOTO],
  ['portraits', MediaType.PORTRAIT],
  ['general', MediaType.GENERAL],
  ['references', MediaType.GENERAL],
  ['content', MediaType.GENERAL],
]);

function resolveAssetVariant(
  asset: Awaited<ReturnType<typeof getPublicMediaAssetByPath>>,
  storagePath: string,
) {
  if (!asset) {
    return null;
  }

  if (
    asset.thumbnailStoragePath === storagePath &&
    asset.thumbnailMimeType &&
    asset.thumbnailSize
  ) {
    return {
      storagePath: asset.thumbnailStoragePath,
      mimeType: asset.thumbnailMimeType,
      size: asset.thumbnailSize,
    };
  }

  if (
    asset.optimizedStoragePath === storagePath &&
    asset.optimizedMimeType &&
    asset.optimizedSize
  ) {
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ kind: string; path?: string[] }> },
) {
  const { kind, path = [] } = await context.params;
  const mediaType = publicMediaTypes.get(kind);

  if (!mediaType || path.length === 0) {
    return NextResponse.json({ message: 'Soubor nebyl nalezen.' }, { status: 404 });
  }

  const storagePath = [kind, ...path].join('/');

  try {
    assertSafeStoragePath(storagePath);
  } catch {
    return NextResponse.json({ message: 'Neplatná cesta k médiu.' }, { status: 400 });
  }

  const asset = await getPublicMediaAssetByPath(storagePath);

  if (!asset) {
    return NextResponse.json({ message: 'Soubor nebyl nalezen.' }, { status: 404 });
  }

  const variant = resolveAssetVariant(asset, storagePath);

  if (!variant) {
    return NextResponse.json({ message: 'Soubor nebyl nalezen.' }, { status: 404 });
  }

  try {
    const file = await localMediaStorage.readFile(asset.visibility, variant.storagePath);

    return new NextResponse(file, {
      headers: {
        'Content-Type': variant.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(variant.size),
        'Content-Disposition': `inline; filename="${variant.storagePath.split('/').pop() ?? asset.storedFilename}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ message: 'Soubor nebyl nalezen.' }, { status: 404 });
  }
}
