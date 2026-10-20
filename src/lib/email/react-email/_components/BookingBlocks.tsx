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
    <Text style={noticeStyle}>Termín najdete také v přiložené kalendářové události.</Text>
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
      {manageReservationUrl ? <Text style={bodyStyle}>Potřebujete jiný čas? Rezervaci můžete jednoduše přesunout.</Text> : null}
      {manageReservationUrl ? (
        <Section style={{ paddingTop: "14px" }}>
          <EmailButton href={manageReservationUrl} label="Změnit termín" />
        </Section>
      ) : null}
      {cancellationUrl ? (
        <Text style={{ margin: manageReservationUrl ? "20px 0 0" : "0" }}>
          <Link href={cancellationUrl} style={cancelLinkStyle}>Zrušit rezervaci</Link>
        </Text>
      ) : null}
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
const noticeStyle = { ...bodyStyle, color: "#74645a", fontSize: "13px", lineHeight: "20px" };
const codeStyle = { margin: "0 0 7px", color: "#1f1714", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "16px", lineHeight: "22px", fontWeight: "700" };
const actionsStyle = { marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #eaded4" };
const cancelLinkStyle = { color: "#74645a", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "13px", lineHeight: "20px", textDecoration: "underline" };
