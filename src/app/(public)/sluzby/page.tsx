import { ServicesPage, buildPageMetadata } from '@/features/public/components/public-site';
import { getPublicServices } from '@/features/public/lib/public-services';

export const metadata = buildPageMetadata({
  title: 'Služby',
  description: 'Kosmetická ošetření, péče o řasy a obočí, masáže, depilace i líčení. Vyberte si službu v PP Studiu ve Zlíně.',
  path: '/sluzby',
});

export default async function Page() {
  await connection();
  const services = await getPublicServices();

  return <ServicesPage services={services} />;
}
import { connection } from "next/server";
