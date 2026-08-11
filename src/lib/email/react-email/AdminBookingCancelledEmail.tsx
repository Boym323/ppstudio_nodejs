import { BookingDetailCard } from "./_components/BookingDetailCard";
import { EmailLayout } from "./_components/EmailLayout";

export type AdminBookingCancelledEmailProps = { brandName: string; serviceName: string; bookingDate: string; bookingTime: string; clientName: string; clientEmail: string };

export function AdminBookingCancelledEmail(props: AdminBookingCancelledEmailProps) {
  return <EmailLayout brandName={props.brandName} title="Rezervace zrušena" intro="" preview={`Rezervace ${props.serviceName} byla zrušena.`}>
    <BookingDetailCard serviceName={props.serviceName} bookingDate={props.bookingDate} bookingTime={props.bookingTime} extraRows={[{ label: "Klientka", value: props.clientName }, { label: "E-mail", value: props.clientEmail }]} />
  </EmailLayout>;
}

const previewProps: AdminBookingCancelledEmailProps = { brandName: "PP Studio", serviceName: "Luxusní kosmetické ošetření", bookingDate: "pondělí 18. května 2026", bookingTime: "10:00 – 11:30", clientName: "Jana Nováková", clientEmail: "jana@example.test" };
export default Object.assign(AdminBookingCancelledEmail, { PreviewProps: previewProps });
