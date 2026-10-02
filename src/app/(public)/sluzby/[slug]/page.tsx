import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { connection } from 'next/server';

import { MetaPixelViewContentTracker } from "@/features/analytics/meta-pixel-view-content-tracker";
import { resolvePublicServiceSlug } from '@/features/public/lib/public-services';
import { ServiceDetailPage, buildPageMetadata, buildServiceBreadcrumbItems } from '@/features/public/components/public-site';
import { SeoJsonLd, buildBreadcrumbListJsonLd, buildServiceJsonLd } from '@/features/public/components/seo-json-ld';
import { getPublicSalonProfile } from '@/lib/site-settings';

type PageParams = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const resolution = await resolvePublicServiceSlug(slug);

  if (!resolution) {
    return buildPageMetadata({
      title: 'Služba nebyla nalezena',
      description: 'Požadovaný detail služby nebyl nalezen.',
      path: `/sluzby/${slug}`,
    });
  }

  return buildPageMetadata({
    title: resolution.service.seoTitle ?? resolution.service.name,
    description: resolution.service.seoDescription,
    path: `/sluzby/${resolution.service.slug}`,
  });
}

export default async function Page({ params }: { params: PageParams }) {
  await connection();
  const { slug } = await params;
  const resolution = await resolvePublicServiceSlug(slug);

  if (!resolution) {
    notFound();
  }

  if (!resolution.isCanonical) {
    permanentRedirect(`/sluzby/${encodeURIComponent(resolution.service.slug)}`);
  }

  const service = resolution.service;

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
