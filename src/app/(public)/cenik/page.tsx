import { buildPageMetadata } from "@/features/public/components/public-site";
import { PricingPage } from "@/features/public/components/pricing-page";
import { getPublicPricingCatalog } from "@/features/public/lib/public-services";

export const metadata = buildPageMetadata({
  title: 'Ceník',
  description: 'Projděte si ceny a délku kosmetických ošetření, péče o řasy a obočí, masáží, depilace i líčení.',
  path: '/cenik',
});

export default async function Page() {
  await connection();
  const categories = await getPublicPricingCatalog();

  return <PricingPage categories={categories} />;
}
import { connection } from "next/server";
