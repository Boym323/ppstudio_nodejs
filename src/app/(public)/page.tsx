import type { Metadata } from "next";
import { connection } from "next/server";

import { PublicHomePage } from '@/features/public/components/public-site';
import { getPublicServices } from '@/features/public/lib/public-services';

export const metadata: Metadata = {
  title: {
    absolute: 'PP Studio | Pavlína Pomykalová',
  },
  description:
    'Moderní prezentační web pro kosmetický salon s důrazem na důvěru, čisté UX a silnou cestu k rezervaci.',
};

export default async function Page() {
  await connection();

  const services = await getPublicServices();

  return <PublicHomePage featuredServices={services.slice(0, 3)} />;
}
