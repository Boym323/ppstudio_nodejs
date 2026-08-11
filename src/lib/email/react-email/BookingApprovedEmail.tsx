import { Section, Text } from "react-email";

import { BookingDetailCard } from "./_components/BookingDetailCard";
import { BookingActionLinks, CalendarNotice, VoucherBlock } from "./_components/BookingBlocks";
import { ContactBlock, LocationBlock } from "./_components/ContactBlocks";
import { EmailLayout } from "./_components/EmailLayout";

export type BookingApprovedEmailProps = {
  brandName: string; serviceName: string; bookingDate: string; bookingTime: string; intendedVoucherCode?: string;
  salonName: string; salonAddress: string; salonEmail: string; salonPhone: string; salonPhoneHref: string; salonMapUrl: string;
  manageReservationUrl?: string; cancellationUrl?: string; includeCalendarAttachment: boolean;
};

export function BookingApprovedEmail(props: BookingApprovedEmailProps) {
  return <EmailLayout brandName={props.brandName} title="Rezervace byla potvrzena" intro="Termín máte potvrzený. Níže najdete praktické údaje k návštěvě a možnosti pro případnou změnu." preview={`Rezervace ${props.serviceName} byla potvrzena.`}>
    <BookingDetailCard serviceName={props.serviceName} bookingDate={props.bookingDate} bookingTime={props.bookingTime} />
    {props.intendedVoucherCode ? <><Spacer /><VoucherBlock code={props.intendedVoucherCode} /></> : null}
    <Spacer /><LocationBlock name={props.salonName} address={props.salonAddress} mapUrl={props.salonMapUrl} />
    {props.includeCalendarAttachment ? <><Spacer /><CalendarNotice /></> : null}
    <BookingActionLinks manageReservationUrl={props.manageReservationUrl} cancellationUrl={props.cancellationUrl} />
    <Spacer /><ContactBlock email={props.salonEmail} phone={props.salonPhone} phoneHref={props.salonPhoneHref} />
  </EmailLayout>;
}

function Spacer() { return <Section style={{ height: "14px", lineHeight: "14px", fontSize: "14px" }}>&nbsp;</Section>; }

const previewProps: BookingApprovedEmailProps = { brandName: "PP Studio", serviceName: "Luxusní kosmetické ošetření", bookingDate: "pondělí 18. května 2026", bookingTime: "10:00 – 11:30", salonName: "PP Studio", salonAddress: "Sadová 2, 760 01 Zlín", salonEmail: "info@example.test", salonPhone: "+420 700 000 000", salonPhoneHref: "tel:+420700000000", salonMapUrl: "https://maps.example.test/pp-studio", manageReservationUrl: "https://example.test/rezervace/sprava/preview", cancellationUrl: "https://example.test/rezervace/storno/preview", includeCalendarAttachment: true };
export default Object.assign(BookingApprovedEmail, { PreviewProps: previewProps });
