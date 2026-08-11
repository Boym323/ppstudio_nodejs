import { Section } from "react-email";

import { BookingDetailCard } from "./_components/BookingDetailCard";
import { VoucherBlock } from "./_components/BookingBlocks";
import { ContactBlock, LocationBlock } from "./_components/ContactBlocks";
import { EmailLayout } from "./_components/EmailLayout";

export type BookingConfirmationEmailProps = {
  brandName: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  intendedVoucherCode?: string;
  salonName: string;
  salonAddress: string;
  salonEmail: string;
  salonPhone: string;
  salonPhoneHref: string;
  salonMapUrl: string;
};

export function BookingConfirmationEmail({
  brandName,
  serviceName,
  bookingDate,
  bookingTime,
  intendedVoucherCode,
  salonName,
  salonAddress,
  salonEmail,
  salonPhone,
  salonPhoneHref,
  salonMapUrl,
}: BookingConfirmationEmailProps) {
  return (
    <EmailLayout
      brandName={brandName}
      title="Rezervace přijata"
      intro="Děkujeme za rezervaci. Termín teď zkontrolujeme a finální potvrzení pošleme dalším e-mailem."
      preview={`Rezervace ${serviceName} byla přijata. Finální potvrzení pošleme dalším e-mailem.`}
    >
      <BookingDetailCard serviceName={serviceName} bookingDate={bookingDate} bookingTime={bookingTime} />
      {intendedVoucherCode ? <VoucherBlock code={intendedVoucherCode} /> : null}
      <Spacer />
      <LocationBlock name={salonName} address={salonAddress} mapUrl={salonMapUrl} />
      <Spacer />
      <ContactBlock email={salonEmail} phone={salonPhone} phoneHref={salonPhoneHref} />
    </EmailLayout>
  );
}

function Spacer() {
  return <Section style={{ height: "14px", lineHeight: "14px", fontSize: "14px" }}>&nbsp;</Section>;
}

const previewProps: BookingConfirmationEmailProps = {
  brandName: "PP Studio",
  serviceName: "Luxusní kosmetické ošetření",
  bookingDate: "pondělí 18. května 2026",
  bookingTime: "10:00 – 11:30",
  intendedVoucherCode: "DÁREK-2026",
  salonName: "PP Studio",
  salonAddress: "Sadová 2, 760 01 Zlín",
  salonEmail: "info@example.test",
  salonPhone: "+420 700 000 000",
  salonPhoneHref: "tel:+420700000000",
  salonMapUrl: "https://maps.example.test/pp-studio",
};

const BookingConfirmationEmailPreview = Object.assign(BookingConfirmationEmail, {
  PreviewProps: previewProps,
});

export default BookingConfirmationEmailPreview;
