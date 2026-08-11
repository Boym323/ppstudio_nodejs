import { Link, Section, Text } from "react-email";

type LocationBlockProps = {
  name: string;
  address: string;
  mapUrl: string;
};

export function LocationBlock({ name, address, mapUrl }: LocationBlockProps) {
  return (
    <Section style={{ ...cardStyle, backgroundColor: "#fffaf6" }}>
      <Text style={labelStyle}>Místo</Text>
      <Text style={locationStyle}>
        <strong>{name}</strong>
        <br />
        {address}
      </Text>
      <Text style={linkTextStyle}>
        <Link href={mapUrl} style={linkStyle}>
          Zobrazit na mapě
        </Link>
      </Text>
    </Section>
  );
}

type ContactBlockProps = {
  email: string;
  phone: string;
  phoneHref: string;
};

export function ContactBlock({ email, phone, phoneHref }: ContactBlockProps) {
  return (
    <Section style={cardStyle}>
      <Text style={labelStyle}>Kontakt</Text>
      <Text style={contactStyle}>
        Napište nám: <Link href={`mailto:${email}`} style={linkStyle}>{email}</Link>
        <br />
        Zavolejte: <Link href={phoneHref} style={linkStyle}>{phone}</Link>
      </Text>
    </Section>
  );
}

const cardStyle = {
  padding: "18px",
  border: "1px solid #eaded4",
  borderRadius: "14px",
  backgroundColor: "#ffffff",
};

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

const locationStyle = {
  margin: "0",
  color: "#1f1714",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "16px",
  lineHeight: "24px",
};

const contactStyle = {
  margin: "0",
  color: "#5b4c44",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "15px",
  lineHeight: "24px",
};

const linkTextStyle = {
  margin: "10px 0 0",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "14px",
  lineHeight: "21px",
};

const linkStyle = { color: "#1f1714", textDecoration: "underline" };
