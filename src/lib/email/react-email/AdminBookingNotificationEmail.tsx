import { Section, Text } from "react-email";

import { BookingDetailCard } from "./_components/BookingDetailCard";
import { EmailButton } from "./_components/EmailButton";
import { EmailLayout } from "./_components/EmailLayout";

export type AdminBookingNotificationEmailProps = {
  brandName: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  clientNote?: string | null;
  approveUrl: string;
  rejectUrl: string;
  adminUrl: string;
};

export function AdminBookingNotificationEmail(props: AdminBookingNotificationEmailProps) {
  const extraRows = [
    { label: "Klientka", value: props.clientName },
    { label: "E-mail", value: props.clientEmail },
    ...(props.clientPhone ? [{ label: "Telefon", value: props.clientPhone }] : []),
    ...(props.clientNote ? [{ label: "Poznámka od klientky", value: props.clientNote }] : []),
  ];

  return <EmailLayout brandName={props.brandName} title="Nová rezervace" intro="" preview={`Nová rezervace: ${props.serviceName}.`}>
    <BookingDetailCard serviceName={props.serviceName} bookingDate={props.bookingDate} bookingTime={props.bookingTime} extraRows={extraRows} />
    <Section style={spacerStyle}>&nbsp;</Section>
    <Section style={actionsStyle}>
      <Text style={actionsTitleStyle}>Rychlé akce</Text>
      <Section style={actionStyle}><EmailButton href={props.approveUrl} label="Potvrdit rezervaci" /></Section>
      <Section style={actionStyle}><EmailButton href={props.adminUrl} label="Přesunout termín" variant="secondary" /></Section>
      <Section style={actionStyle}><EmailButton href={props.rejectUrl} label="Zrušit rezervaci" variant="destructive" /></Section>
      <EmailButton href={props.adminUrl} label="Otevřít v administraci" variant="secondary" />
    </Section>
  </EmailLayout>;
}

const spacerStyle = { height: "14px", lineHeight: "14px", fontSize: "14px" };
const actionsStyle = { padding: "18px", border: "1px solid #eaded4", borderRadius: "14px", backgroundColor: "#ffffff" };
const actionsTitleStyle = { margin: "0 0 14px", color: "#1f1714", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "18px", lineHeight: "24px", fontWeight: "700" };
const actionStyle = { marginBottom: "12px" };

const previewProps: AdminBookingNotificationEmailProps = {
  brandName: "PP Studio", serviceName: "Luxusní kosmetické ošetření", bookingDate: "pondělí 18. května 2026", bookingTime: "10:00 – 11:30",
  clientName: "Jana Nováková", clientEmail: "jana@example.test", clientPhone: "+420 700 000 000", clientNote: "Prosím o konzultaci před začátkem.",
  approveUrl: "https://example.invalid/admin/action?token=preview-token", rejectUrl: "https://example.invalid/admin/action?token=preview-token", adminUrl: "https://example.invalid/admin/rezervace/preview",
};

export default Object.assign(AdminBookingNotificationEmail, { PreviewProps: previewProps });
