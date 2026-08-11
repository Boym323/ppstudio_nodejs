import { Section } from "react-email";
import { BookingDetailCard } from "./_components/BookingDetailCard";
import { NewBookingButton } from "./_components/BookingBlocks";
import { ContactBlock, LocationBlock } from "./_components/ContactBlocks";
import { EmailLayout } from "./_components/EmailLayout";

export type BookingRejectedEmailProps = { brandName: string; serviceName: string; bookingDate: string; bookingTime: string; salonName: string; salonAddress: string; salonEmail: string; salonPhone: string; salonPhoneHref: string; salonMapUrl: string; newBookingUrl: string };
export function BookingRejectedEmail(props: BookingRejectedEmailProps) { return <EmailLayout brandName={props.brandName} title="Rezervaci se tentokrát nepodařilo potvrdit" intro="Požadovaný termín už bohužel není dostupný. Můžete si vybrat jiný termín nebo se nám ozvat." preview={`Rezervaci ${props.serviceName} se nepodařilo potvrdit.`}><BookingDetailCard serviceName={props.serviceName} bookingDate={props.bookingDate} bookingTime={props.bookingTime} /><Spacer /><LocationBlock name={props.salonName} address={props.salonAddress} mapUrl={props.salonMapUrl} /><Spacer /><NewBookingButton href={props.newBookingUrl} /><Spacer /><ContactBlock email={props.salonEmail} phone={props.salonPhone} phoneHref={props.salonPhoneHref} /></EmailLayout>; }
function Spacer() { return <Section style={{ height: "14px", lineHeight: "14px", fontSize: "14px" }}>&nbsp;</Section>; }
const previewProps: BookingRejectedEmailProps = { brandName: "PP Studio", serviceName: "Luxusní kosmetické ošetření", bookingDate: "pondělí 18. května 2026", bookingTime: "10:00 – 11:30", salonName: "PP Studio", salonAddress: "Sadová 2, 760 01 Zlín", salonEmail: "info@example.test", salonPhone: "+420 700 000 000", salonPhoneHref: "tel:+420700000000", salonMapUrl: "https://maps.example.test/pp-studio", newBookingUrl: "https://example.test/rezervace" };
export default Object.assign(BookingRejectedEmail, { PreviewProps: previewProps });
