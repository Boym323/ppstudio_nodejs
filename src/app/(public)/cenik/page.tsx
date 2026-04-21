import { connection } from "next/server";

import { buildPageMetadata } from "@/features/public/components/public-site";
import { PricingPage } from "@/features/public/components/pricing-page";
import { getPublicPricingCatalog } from "@/features/public/lib/public-services";

export const metadata = buildPageMetadata({
  title: 'Ceník',
  description: 'Přehledný ceník kosmetických služeb navržený pro rychlé rozhodnutí a pohodlné čtení na mobilu.',
});

export default async function Page() {
  await connection();

  const categories = await getPublicPricingCatalog();

  return <PricingPage categories={categories} />;
}
