import { MediaAssetKind } from '@prisma/client';

import { getPublicMediaLibraryByKind } from '@/features/media/lib/media-library';

export type PublicCertificate = {
  id: string;
  title: string | null;
  alt: string | null;
  imageUrl: string;
  width: number | null;
  height: number | null;
};

export async function getPublicCertificates(): Promise<PublicCertificate[]> {
  const assets = await getPublicMediaLibraryByKind(MediaAssetKind.CERTIFICATE);

  return assets.map((asset) => ({
    id: asset.id,
    title: asset.title,
    alt: asset.alt,
    imageUrl: asset.publicUrl,
    width: asset.width,
    height: asset.height,
  }));
}
