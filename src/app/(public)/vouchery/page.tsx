import { buildPageMetadata } from "@/features/public/components/public-page-metadata";
import { VoucherLandingPage } from "@/features/public/components/voucher-landing-page";
import { getVoucherSuggestedServices } from "@/features/public/lib/public-services";

export const metadata = buildPageMetadata({
  title: "Dárkové vouchery",
  description:
    "Dárkový voucher do PP Studia ve Zlíně pro péči o pleť, lash lifting nebo laminaci obočí. Voucher lze vystavit na konkrétní službu i podle individuální domluvy.",
  path: "/vouchery",
});

export default async function Page() {
  const suggestedServices = await getVoucherSuggestedServices();

  return <VoucherLandingPage suggestedServices={suggestedServices} />;
}
