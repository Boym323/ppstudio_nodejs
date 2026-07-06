import { SeoJsonLd, buildHomePageJsonLd } from "@/features/public/components/seo-json-ld";
import { PublicHomePage, buildPageMetadata } from '@/features/public/components/public-site';
import { getHomepageFeaturedServices } from '@/features/public/lib/public-services';

export const metadata = buildPageMetadata({
  title: 'PP Studio | Kosmetika Zlín',
  description:
    'PP Studio Pavlíny Pomykalové ve Zlíně nabízí kosmetická ošetření pleti, péči o řasy a obočí, depilaci, líčení a online rezervaci termínu.',
  path: '/',
  absoluteTitle: true,
});

export default async function Page() {
  const featuredServices = await getHomepageFeaturedServices();

  return (
    <>
      <SeoJsonLd data={buildHomePageJsonLd()} />
      <PublicHomePage featuredServices={featuredServices} />
    </>
  );
}
