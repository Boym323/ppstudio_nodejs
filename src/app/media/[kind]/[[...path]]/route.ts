import { MediaAssetKind } from '@prisma/client';
import { NextResponse } from 'next/server';

import { localMediaStorage } from '@/lib/media/local-media-storage';
import { assertSafeStoragePath } from '@/lib/media/media-path';
import { getPublicMediaAssetByKindAndPath } from '@/features/media/lib/media-asset-repository';

const publicMediaKinds = new Map<string, MediaAssetKind>([
  ['certificates', MediaAssetKind.CERTIFICATE],
  ['spaces', MediaAssetKind.SPACE],
  ['references', MediaAssetKind.REFERENCE],
  ['content', MediaAssetKind.CONTENT],
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ kind: string; path?: string[] }> },
) {
  const { kind, path = [] } = await context.params;
  const mediaKind = publicMediaKinds.get(kind);

  if (!mediaKind || path.length === 0) {
    return NextResponse.json({ message: 'Soubor nebyl nalezen.' }, { status: 404 });
  }

  const storagePath = [kind, ...path].join('/');

  try {
    assertSafeStoragePath(storagePath);
  } catch {
    return NextResponse.json({ message: 'Neplatná cesta k médiu.' }, { status: 400 });
  }

  const asset = await getPublicMediaAssetByKindAndPath(mediaKind, storagePath);

  if (!asset) {
    return NextResponse.json({ message: 'Soubor nebyl nalezen.' }, { status: 404 });
  }

  try {
    const file = await localMediaStorage.readFile(asset.visibility, asset.storagePath);

    return new NextResponse(file, {
      headers: {
        'Content-Type': asset.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(asset.sizeBytes),
        'Content-Disposition': `inline; filename="${asset.storedFilename}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ message: 'Soubor nebyl nalezen.' }, { status: 404 });
  }
}
