import { connection } from "next/server";

import { PricingPage, buildPageMetadata } from '@/features/public/components/public-site';
import { getPublicServices } from '@/features/public/lib/public-services';

export const metadata = buildPageMetadata({
  title: 'Ceník',
  description: 'Přehledný ceník kosmetických služeb navržený pro rychlé rozhodnutí a pohodlné čtení na mobilu.',
});

export default async function Page() {
  await connection();

  const services = await getPublicServices();

  return <PricingPage services={services} />;
}
