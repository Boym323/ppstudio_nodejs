import { ServicesPage, buildPageMetadata } from '@/features/public/components/public-site';
import { getPublicServices } from '@/features/public/lib/public-services';

export const metadata = buildPageMetadata({
  title: 'Naše služby',
  description: 'Prohlédněte si kosmetická ošetření, péči o řasy a obočí, masáže, depilaci i líčení. U každé služby najdete podrobnosti, cenu a délku.',
  path: '/sluzby',
});

export default async function Page() {
  await connection();
  const services = await getPublicServices();

  return <ServicesPage services={services} />;
}
import { connection } from "next/server";
