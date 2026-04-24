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

  try {
    const file = await localMediaStorage.readFile(asset.visibility, asset.storagePath);

    return new NextResponse(file, {
      headers: {
        'Content-Type': asset.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(asset.size),
        'Content-Disposition': `inline; filename="${asset.storedFilename}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ message: 'Soubor nebyl nalezen.' }, { status: 404 });
  }
}
