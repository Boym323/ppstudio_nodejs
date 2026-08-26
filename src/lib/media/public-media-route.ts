import { NextResponse } from 'next/server';

import { getPublicMediaAssetByPath } from '@/features/media/lib/media-asset-repository';
import { getMediaStorageAdapter } from '@/lib/media/media-storage';
import { assertSafeStoragePath } from '@/lib/media/media-path';
import { publicMediaStorageRoots, resolveAssetVariant } from '@/lib/media/media-route';

export async function GET(
  _request: Request,
  context: { params: Promise<{ kind: string; path?: string[] }> },
) {
  const { kind, path = [] } = await context.params;
  if (!publicMediaStorageRoots.has(kind) || path.length === 0) {
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
    const file = await getMediaStorageAdapter(asset.storageProvider).readFile(asset.visibility, variant.storagePath);

    return new NextResponse(Uint8Array.from(file), {
      headers: {
        'Content-Type': variant.mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(variant.size),
        'Content-Disposition': `inline; filename="${variant.storagePath.split('/').pop() ?? asset.fileName}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return NextResponse.json({ message: 'Soubor nebyl nalezen.' }, { status: 404 });
  }
}
