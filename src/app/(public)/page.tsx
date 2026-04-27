import type { Metadata } from "next";
import { connection } from "next/server";

import { PublicHomePage } from '@/features/public/components/public-site';
import { getPublicServices } from '@/features/public/lib/public-services';

export const metadata: Metadata = {
  title: {
    absolute: 'PP Studio | Pavlína Pomykalová',
  },
  description:
    'PP Studio Pavlíny Pomykalové ve Zlíně nabízí kosmetická ošetření pleti, péči o řasy a obočí, depilaci, líčení a online rezervaci termínu.',
};

export default async function Page() {
  await connection();

  const services = await getPublicServices();

  return <PublicHomePage featuredServices={services.slice(0, 3)} />;
}
