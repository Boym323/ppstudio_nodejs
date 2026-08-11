import { Link, Section, Text } from "react-email";

import { EmailLayout } from "./_components/EmailLayout";

export type VoucherSentEmailProps = {
  brandName: string;
  voucherTypeLabel: string;
  voucherMainFieldLabel: string;
  voucherMainLabel: string;
  voucherCode: string;
  validUntilLabel: string;
  verificationUrl: string;
  contactRows: string[];
};

export function VoucherSentEmail({
  brandName,
  voucherTypeLabel,
  voucherMainFieldLabel,
  voucherMainLabel,
  voucherCode,
  validUntilLabel,
  verificationUrl,
  contactRows,
}: VoucherSentEmailProps) {
  return (
    <EmailLayout
      brandName={brandName}
      title="Dárkový poukaz"
      intro={`Dobrý den, v příloze zasíláme dárkový poukaz ${brandName}.`}
      preview={`Dárkový poukaz ${voucherCode} od ${brandName}.`}
    >
      <VoucherDetailCard rows={[
        { label: "Typ poukazu", value: voucherTypeLabel },
        { label: voucherMainFieldLabel, value: voucherMainLabel },
        { label: "Kód voucheru", value: voucherCode },
        { label: "Platnost do", value: validUntilLabel },
      ]} />
      <Text style={bodyTextStyle}>Poukaz můžete uplatnit při online rezervaci nebo osobně v salonu.</Text>
      <Text style={bodyTextStyle}>
        Platnost poukazu si můžete ověřit zde:
        <br />
        <Link href={verificationUrl} style={linkStyle}>{verificationUrl}</Link>
      </Text>
      <Text style={bodyTextStyle}>Těšíme se na Vaši návštěvu.</Text>
      {contactRows.length > 0 ? <Text style={contactStyle}>{contactRows.map((row, index) => <span key={`${row}-${index}`}>{index > 0 ? <br /> : null}{row}</span>)}</Text> : null}
    </EmailLayout>
  );
}

function VoucherDetailCard({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return <Section style={cardStyle}>{rows.map((row, index) => (
    <Section key={row.label} style={{ ...rowStyle, ...(index === rows.length - 1 ? undefined : rowBorderStyle) }}>
      <Text style={labelStyle}>{row.label}</Text>
      <Text style={valueStyle}>{row.value}</Text>
    </Section>
  ))}</Section>;
}

const cardStyle = { padding: "18px", border: "1px solid #eaded4", borderRadius: "14px", backgroundColor: "#fbf7f3" };
const rowStyle = { padding: "10px 0" };
const rowBorderStyle = { borderBottom: "1px solid #eaded4" };
const labelStyle = { margin: "0 0 4px", color: "#9e7f65", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "12px", lineHeight: "16px", fontWeight: "700", letterSpacing: "0.08em", textTransform: "uppercase" as const };
const valueStyle = { margin: "0", color: "#1f1714", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "16px", lineHeight: "24px", fontWeight: "700" };
const bodyTextStyle = { margin: "18px 0 0", color: "#5b4c44", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "15px", lineHeight: "24px" };
const contactStyle = { margin: "18px 0 0", color: "#5b4c44", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "14px", lineHeight: "22px" };
const linkStyle = { color: "#1f1714", textDecoration: "underline" };

const previewProps: VoucherSentEmailProps = {
  brandName: "PP Studio", voucherTypeLabel: "Hodnotový poukaz", voucherMainFieldLabel: "Hodnota", voucherMainLabel: "1 500 Kč", voucherCode: "UKAZKA-2026", validUntilLabel: "28. dubna 2027",
  verificationUrl: "https://example.test/vouchery/overeni?code=UKAZKA-2026",
  contactRows: ["PP Studio", "Sadová 2, 760 01 Zlín", "+420 700 000 000", "info@example.test", "example.test"],
};

export default Object.assign(VoucherSentEmail, { PreviewProps: previewProps });
