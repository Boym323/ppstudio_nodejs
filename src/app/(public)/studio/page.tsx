import { connection } from 'next/server';

import { StudioPage } from '@/features/public/components/studio/studio-page';
import { buildPageMetadata } from '@/features/public/components/public-site';
import { getPublicStudioPhotos } from '@/features/public/lib/public-studio-photos';

export const metadata = buildPageMetadata({
  title: 'Studio | PP Studio',
  description: 'Nahlédněte do klidného prostředí PP Studia, kde probíhá osobní péče o pleť, řasy a obočí bez zbytečného spěchu.',
});

export default async function Page() {
  await connection();
  const photos = await getPublicStudioPhotos();

  return <StudioPage photos={photos} />;
}
