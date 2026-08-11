import { Section } from "react-email";

import { BookingDetailCard } from "./_components/BookingDetailCard";
import { EmailButton } from "./_components/EmailButton";
import { EmailLayout } from "./_components/EmailLayout";

export type AdminBookingRescheduledEmailProps = { brandName: string; serviceName: string; bookingDate: string; bookingTime: string; previousDate: string; previousTime: string; clientName: string; clientEmail: string; adminUrl: string };

export function AdminBookingRescheduledEmail(props: AdminBookingRescheduledEmailProps) {
  return <EmailLayout brandName={props.brandName} title="Rezervace přesunuta klientkou" intro="" preview={`Rezervace ${props.serviceName} byla přesunuta.`}>
    <BookingDetailCard serviceName={props.serviceName} bookingDate={props.bookingDate} bookingTime={props.bookingTime} extraRows={[{ label: "Původní termín", value: `${props.previousDate}, ${props.previousTime}` }, { label: "Klientka", value: props.clientName }, { label: "E-mail", value: props.clientEmail }]} />
    <Section style={spacerStyle}>&nbsp;</Section>
    <EmailButton href={props.adminUrl} label="Otevřít rezervaci v administraci" variant="secondary" />
  </EmailLayout>;
}

const spacerStyle = { height: "14px", lineHeight: "14px", fontSize: "14px" };
const previewProps: AdminBookingRescheduledEmailProps = { brandName: "PP Studio", serviceName: "Luxusní kosmetické ošetření", bookingDate: "úterý 19. května 2026", bookingTime: "10:00 – 11:30", previousDate: "pondělí 18. května 2026", previousTime: "09:00 – 10:30", clientName: "Jana Nováková", clientEmail: "jana@example.test", adminUrl: "https://example.invalid/admin/rezervace/preview" };
export default Object.assign(AdminBookingRescheduledEmail, { PreviewProps: previewProps });
