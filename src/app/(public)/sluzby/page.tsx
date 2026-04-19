import { connection } from "next/server";

import { ServicesPage, buildPageMetadata } from '@/features/public/components/public-site';
import { getPublicServices } from '@/features/public/lib/public-services';

export const metadata = buildPageMetadata({
  title: 'Služby',
  description: 'Přehled kosmetických služeb s důrazem na srozumitelnost, důvěru a jednoduchý výběr vhodné péče.',
});

export default async function Page() {
  await connection();

  const services = await getPublicServices();

  return <ServicesPage services={services} />;
}
