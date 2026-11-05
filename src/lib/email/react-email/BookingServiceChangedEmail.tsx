import { Section, Text } from "react-email";

import { BookingDetailCard } from "./_components/BookingDetailCard";
import { BookingActionLinks } from "./_components/BookingBlocks";
import { ContactBlock, LocationBlock } from "./_components/ContactBlocks";
import { EmailLayout } from "./_components/EmailLayout";

type BookingServiceChangedEmailProps = {
  brandName: string;
  serviceName: string;
  intro: string;
  calendarNotice: string;
  bookingDate: string;
  bookingTime: string;
  priceLabel: string;
  price: string;
  statusLabel: string;
  salonName: string;
  salonAddress: string;
  salonEmail: string;
  salonPhone: string;
  salonPhoneHref: string;
  salonMapUrl: string;
  manageReservationUrl: string;
  cancellationUrl: string;
};

export function BookingServiceChangedEmail(props: BookingServiceChangedEmailProps) {
  return (
    <EmailLayout brandName={props.brandName} title="Změna vaší rezervace"
      intro={props.intro}
      preview={`Nová služba vaší rezervace: ${props.serviceName}`}>
      <BookingDetailCard serviceName={props.serviceName} bookingDate={props.bookingDate} bookingTime={props.bookingTime}
        extraRows={[
          { label: props.priceLabel, value: props.price },
          { label: "Stav rezervace", value: props.statusLabel },
        ]} />
      <Section style={{ height: "14px" }} />
      <LocationBlock name={props.salonName} address={props.salonAddress} mapUrl={props.salonMapUrl} />
      <Text style={{ color: "#74645a", fontSize: "13px", lineHeight: "20px" }}>{props.calendarNotice}</Text>
      <BookingActionLinks manageReservationUrl={props.manageReservationUrl} cancellationUrl={props.cancellationUrl} />
      <Section style={{ height: "14px" }} />
      <ContactBlock email={props.salonEmail} phone={props.salonPhone} phoneHref={props.salonPhoneHref} />
    </EmailLayout>
  );
}
