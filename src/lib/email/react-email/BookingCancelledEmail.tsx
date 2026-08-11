import { Section } from "react-email";
import { BookingDetailCard } from "./_components/BookingDetailCard";
import { NewBookingButton, VoucherBlock } from "./_components/BookingBlocks";
import { ContactBlock, LocationBlock } from "./_components/ContactBlocks";
import { EmailLayout } from "./_components/EmailLayout";

export type BookingCancelledEmailProps = { brandName: string; serviceName: string; bookingDate: string; bookingTime: string; intendedVoucherCode?: string; salonName: string; salonAddress: string; salonEmail: string; salonPhone: string; salonPhoneHref: string; salonMapUrl: string; newBookingUrl: string };
export function BookingCancelledEmail(props: BookingCancelledEmailProps) { return <EmailLayout brandName={props.brandName} title="Rezervace byla zrušena" intro="Vaši rezervaci jsme zrušili. Kdybyste si chtěla vybrat nový termín, můžete pokračovat přes odkaz níže." preview={`Rezervace ${props.serviceName} byla zrušena.`}><BookingDetailCard serviceName={props.serviceName} bookingDate={props.bookingDate} bookingTime={props.bookingTime} />{props.intendedVoucherCode ? <><Spacer /><VoucherBlock code={props.intendedVoucherCode} /></> : null}<Spacer /><LocationBlock name={props.salonName} address={props.salonAddress} mapUrl={props.salonMapUrl} /><Spacer /><NewBookingButton href={props.newBookingUrl} /><Spacer /><ContactBlock email={props.salonEmail} phone={props.salonPhone} phoneHref={props.salonPhoneHref} /></EmailLayout>; }
function Spacer() { return <Section style={{ height: "14px", lineHeight: "14px", fontSize: "14px" }}>&nbsp;</Section>; }
const previewProps: BookingCancelledEmailProps = { brandName: "PP Studio", serviceName: "Luxusní kosmetické ošetření", bookingDate: "pondělí 18. května 2026", bookingTime: "10:00 – 11:30", intendedVoucherCode: "DÁREK-2026", salonName: "PP Studio", salonAddress: "Sadová 2, 760 01 Zlín", salonEmail: "info@example.test", salonPhone: "+420 700 000 000", salonPhoneHref: "tel:+420700000000", salonMapUrl: "https://maps.example.test/pp-studio", newBookingUrl: "https://example.test/rezervace" };
export default Object.assign(BookingCancelledEmail, { PreviewProps: previewProps });
