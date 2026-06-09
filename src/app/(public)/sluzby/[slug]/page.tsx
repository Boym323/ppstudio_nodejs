import type { Metadata } from 'next';
import { connection } from "next/server";
import { notFound } from 'next/navigation';

import { MetaPixelViewContentTracker } from "@/features/analytics/meta-pixel-view-content-tracker";
import { getPublicServiceBySlug } from '@/features/public/lib/public-services';
import { ServiceDetailPage, buildPageMetadata, buildServiceBreadcrumbItems } from '@/features/public/components/public-site';
import { SeoJsonLd, buildBreadcrumbListJsonLd, buildServiceJsonLd } from '@/features/public/components/seo-json-ld';
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
    title: service.seoTitle ?? service.name,
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
  const breadcrumbItems = buildServiceBreadcrumbItems(service);

  return (
    <>
      <SeoJsonLd data={buildServiceJsonLd(service, salonProfile)} />
      <SeoJsonLd data={buildBreadcrumbListJsonLd(breadcrumbItems)} />
      <MetaPixelViewContentTracker
        service={{
          slug: service.slug,
          name: service.name,
          category: service.category,
          durationMinutes: service.durationMinutes,
        }}
      />
      <ServiceDetailPage service={service} />
    </>
  );
}
