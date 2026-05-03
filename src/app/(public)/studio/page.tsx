import { StudioPage } from '@/features/public/components/studio/studio-page';
import { buildPageMetadata } from '@/features/public/components/public-site';
import { getPublicStudioPhotos } from '@/features/public/lib/public-studio-photos';

export const metadata = buildPageMetadata({
  title: 'Studio',
  description: 'Prohlédněte si prostředí PP Studia ještě před první návštěvou.',
  path: '/studio',
});

export default async function Page() {
  const photos = await getPublicStudioPhotos();
  return <StudioPage photos={photos} />;
}
