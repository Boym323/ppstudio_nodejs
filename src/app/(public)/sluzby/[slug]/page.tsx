import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getServiceBySlug, services } from '@/content/public-site';
import { ServiceDetailPage, buildPageMetadata } from '@/features/public/components/public-site';

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const service = getServiceBySlug(params.slug);

  if (!service) {
    return buildPageMetadata({
      title: 'Služba nebyla nalezena',
      description: 'Požadovaný detail služby nebyl nalezen.',
    });
  }

  return buildPageMetadata({
    title: service.name,
    description: service.seoDescription,
  });
}

export default function Page({ params }: { params: { slug: string } }) {
  const service = getServiceBySlug(params.slug);

  if (!service) {
    notFound();
  }

  return <ServiceDetailPage service={service} />;
}
