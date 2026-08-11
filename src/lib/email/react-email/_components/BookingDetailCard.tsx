import { Section, Text } from "react-email";

type BookingDetailCardProps = {
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  extraRows?: Array<{ label: string; value: string }>;
};

export function BookingDetailCard({ serviceName, bookingDate, bookingTime, extraRows = [] }: BookingDetailCardProps) {
  return (
    <Section style={cardStyle}>
      <DetailRow label="Služba" value={serviceName} />
      <DetailRow label="Datum" value={bookingDate} />
      <DetailRow label="Čas" value={bookingTime} last={extraRows.length === 0} />
      {extraRows.map((row, index) => (
        <DetailRow key={row.label} label={row.label} value={row.value} last={index === extraRows.length - 1} />
      ))}
    </Section>
  );
}

function DetailRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <Section style={{ ...rowStyle, ...(last ? undefined : rowBorderStyle) }}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
    </Section>
  );
}

const cardStyle = {
  padding: "18px",
  border: "1px solid #eaded4",
  borderRadius: "14px",
  backgroundColor: "#fbf7f3",
};

const rowStyle = { padding: "12px 0" };
const rowBorderStyle = { borderBottom: "1px solid #eaded4" };

const labelStyle = {
  margin: "0 0 5px",
  color: "#9e7f65",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "12px",
  lineHeight: "16px",
  fontWeight: "700",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
};

const valueStyle = {
  margin: "0",
  color: "#1f1714",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "17px",
  lineHeight: "25px",
  fontWeight: "700",
};
