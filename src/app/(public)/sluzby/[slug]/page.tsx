import type { Metadata } from 'next';
import { connection } from "next/server";
import { notFound } from 'next/navigation';

import { getPublicServiceBySlug } from '@/features/public/lib/public-services';
import { ServiceDetailPage, buildPageMetadata } from '@/features/public/components/public-site';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const service = await getPublicServiceBySlug(params.slug);

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

export default async function Page({ params }: { params: { slug: string } }) {
  await connection();

  const service = await getPublicServiceBySlug(params.slug);

  if (!service) {
    notFound();
  }

  return <ServiceDetailPage service={service} />;
}
