import { buildPageMetadata } from "@/features/public/components/public-site";
import { PricingPage } from "@/features/public/components/pricing-page";
import { getPublicPricingCatalog } from "@/features/public/lib/public-services";

export const metadata = buildPageMetadata({
  title: 'Ceník',
  description: 'Kolik stojí ošetření v PP Studiu ve Zlíně a kolik času si na něj vyhradit? Prohlédněte si kompletní ceník služeb.',
  path: '/cenik',
});

export default async function Page() {
  await connection();
  const categories = await getPublicPricingCatalog();

  return <PricingPage categories={categories} />;
}
import { connection } from "next/server";
