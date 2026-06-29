import { buildContactItems } from "@/content/public-site";
import { Container } from "@/components/ui/container";
import {
  ContactHero,
  ContactMapPreviewCard,
  ContactMobileStickyCTA,
  ContactParkingInfoCard,
  QuickContactCard,
} from "@/features/public/components/contact-sections";
import { getPrimaryPublicContactPhoto } from "@/features/public/lib/public-studio-photos";
import { getPublicSalonProfile } from "@/lib/site-settings";

export async function ContactPage() {
  const [salonProfile, heroPhoto] = await Promise.all([
    getPublicSalonProfile(),
    getPrimaryPublicContactPhoto(),
  ]);
  const contactItems = buildContactItems({
    phone: salonProfile.phone,
    email: salonProfile.email,
    addressLine: salonProfile.addressLine,
    instagramUrl: salonProfile.instagramUrl,
  });
  const addressItem = contactItems.find((item) => item.label === "Adresa salonu");
  const parkingRateHref = "https://www.tszlin.cz/uploads/2026-02-27/Sazebn%C3%ADk%20parkovn%C3%A9ho%20platn%C3%BD%20od%201.3.2026%20%C4%8Distopis.pdf";
  const congressParkingHref = "https://kc-zlin.cz/24846-pro-navstevniky";

  return (
    <div className="pb-24 sm:pb-12">
      <ContactHero
        title="Pokud si nejste jistá, napište mi."
        description="Ráda vám pomohu s výběrem služby i termínu. Najdete mě ve Zlíně a ozvat se můžete telefonicky, e-mailem i přes Instagram."
        phone={salonProfile.phone}
        email={salonProfile.email}
        instagramUrl={salonProfile.instagramUrl}
        photo={
          heroPhoto
            ? {
                src: heroPhoto.imageUrl,
                title: "Soukromé místo pro chvíli péče",
                alt: heroPhoto.altText,
                width: heroPhoto.width ?? 1280,
                height: heroPhoto.height ?? 960,
              }
            : null
        }
      />
      <section id="kontaktni-karty" className="py-8 sm:py-12 lg:py-14">
        <Container className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr] lg:items-stretch">
            {addressItem ? <ContactMapPreviewCard address={addressItem.value} href={addressItem.href ?? "#"} /> : null}
            <QuickContactCard
              phone={salonProfile.phone}
              email={salonProfile.email}
              instagramUrl={salonProfile.instagramUrl}
              operatorName={salonProfile.operatorName}
              operatorId={salonProfile.businessId}
              openingHours="Po-Pá: Dle objednávek"
            />
          </div>
          <ContactParkingInfoCard parkingRateHref={parkingRateHref} congressParkingHref={congressParkingHref} />
        </Container>
      </section>
      <ContactMobileStickyCTA phone={salonProfile.phone} email={salonProfile.email} />
    </div>
  );
}
