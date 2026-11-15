import { NextResponse, type NextRequest } from 'next/server';

import { getPublicMediaAssetByPath } from '@/features/media/lib/media-asset-repository';
import { assertSafeStoragePath } from '@/lib/media/media-path';
import { publicMediaStorageRoots } from '@/lib/media/media-route';

// Next.js při selhání obnovy vrací starou optimalizovanou fotografii.
// Publikaci proto ověřujeme před vstupem do jeho cache.
export async function checkPublicMediaImageAccess(request: NextRequest) {
  const source = request.nextUrl.searchParams.get('url');
  if (!source) return NextResponse.next();

  let pathname: string;
  try {
    const url = new URL(source, request.url);
    if (url.origin !== request.nextUrl.origin) return NextResponse.next();
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return NextResponse.json({ message: 'Neplatná cesta k médiu.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  if (!pathname.startsWith('/media/')) return NextResponse.next();
  const storagePath = pathname.slice('/media/'.length).replace(/^public\//, '');
  try {
    assertSafeStoragePath(storagePath);
    if (!publicMediaStorageRoots.has(storagePath.split('/')[0])) throw new Error('MEDIA_STORAGE_PATH_INVALID');
  } catch {
    return NextResponse.json({ message: 'Neplatná cesta k médiu.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const asset = await getPublicMediaAssetByPath(storagePath);
  if (!asset) {
    return NextResponse.json({ message: 'Soubor nebyl nalezen.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.next();
}
