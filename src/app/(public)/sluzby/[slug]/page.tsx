import type { Metadata } from 'next';
import { connection } from "next/server";
import { notFound } from 'next/navigation';

import { getPublicServiceBySlug } from '@/features/public/lib/public-services';
import { ServiceDetailPage, buildPageMetadata } from '@/features/public/components/public-site';
import { SeoJsonLd, buildServiceJsonLd } from '@/features/public/components/seo-json-ld';
import { getPublicSalonProfile } from '@/lib/site-settings';

type PageParams = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { slug } = await params;
  const service = await getPublicServiceBySlug(slug);

  if (!service) {
    return buildPageMetadata({
      title: 'Služba nebyla nalezena',
      description: 'Požadovaný detail služby nebyl nalezen.',
      path: `/sluzby/${slug}`,
    });
  }

  return buildPageMetadata({
    title: service.name,
    description: service.seoDescription,
    path: `/sluzby/${service.slug}`,
  });
}

export default async function Page({ params }: { params: PageParams }) {
  await connection();

  const { slug } = await params;
  const service = await getPublicServiceBySlug(slug);

  if (!service) {
    notFound();
  }

  const salonProfile = await getPublicSalonProfile();

  return (
    <>
      <SeoJsonLd data={buildServiceJsonLd(service, salonProfile)} />
      <ServiceDetailPage service={service} />
    </>
  );
}
