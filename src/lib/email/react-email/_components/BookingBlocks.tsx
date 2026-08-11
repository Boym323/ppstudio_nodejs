import { Link, Section, Text } from "react-email";

import { EmailButton } from "./EmailButton";

export function VoucherBlock({ code }: { code: string }) {
  return (
    <Section style={voucherStyle}>
      <Text style={labelStyle}>Dárkový poukaz</Text>
      <Text style={codeStyle}>{code}</Text>
      <Text style={bodyStyle}>
        U rezervace jste uvedla dárkový poukaz. Poukaz bude ověřen a uplatněn při návštěvě v salonu.
      </Text>
    </Section>
  );
}

export function CalendarNotice() {
  return (
    <Section style={noticeStyle}>
      <Text style={labelStyle}>Kalendář</Text>
      <Text style={bodyStyle}>Termín najdete také v přiložené kalendářové události.</Text>
    </Section>
  );
}

export function BookingActionLinks({ manageReservationUrl, cancellationUrl }: {
  manageReservationUrl?: string;
  cancellationUrl?: string;
}) {
  if (!manageReservationUrl && !cancellationUrl) return null;

  return (
    <Section style={actionsStyle}>
      <Text style={labelStyle}>Správa rezervace</Text>
      {manageReservationUrl ? <Link href={manageReservationUrl} style={manageLinkStyle}>Změnit termín</Link> : null}
      {cancellationUrl ? <Link href={cancellationUrl} style={cancelLinkStyle}>Zrušit rezervaci</Link> : null}
    </Section>
  );
}

export function NewBookingButton({ href }: { href: string }) {
  return <EmailButton href={href} label="Vybrat nový termín" variant="secondary" />;
}

const labelStyle = {
  margin: "0 0 7px",
  color: "#9e7f65",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "12px",
  lineHeight: "16px",
  fontWeight: "700",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
};

const bodyStyle = {
  margin: "0",
  color: "#5b4c44",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "15px",
  lineHeight: "24px",
};

const voucherStyle = { marginTop: "14px", padding: "18px", border: "1px solid #eaded4", borderRadius: "14px", backgroundColor: "#ffffff" };
const noticeStyle = { padding: "18px", border: "1px solid #eaded4", borderRadius: "14px", backgroundColor: "#ffffff" };
const codeStyle = { margin: "0 0 7px", color: "#1f1714", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "16px", lineHeight: "22px", fontWeight: "700" };
const actionsStyle = { marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #eaded4" };
const manageLinkStyle = { display: "inline-block", margin: "0 14px 8px 0", color: "#1f1714", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "14px", lineHeight: "20px", fontWeight: "700", textDecoration: "underline" };
const cancelLinkStyle = { display: "inline-block", margin: "0 0 8px", color: "#7f322a", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "14px", lineHeight: "20px", fontWeight: "700", textDecoration: "underline" };
