import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "react-email";
import type { ReactNode } from "react";

type EmailLayoutProps = {
  brandName: string;
  title: string;
  intro: string;
  preview: string;
  children: ReactNode;
};

export function EmailLayout({ brandName, title, intro, preview, children }: EmailLayoutProps) {
  return (
    <Html lang="cs">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={contentStyle}>
            <Text style={brandStyle}>{brandName}</Text>
            <Heading as="h1" style={titleStyle}>
              {title}
            </Heading>
            <Text style={introStyle}>{intro}</Text>
            {children}
            <Section style={footerStyle}>
              <Text style={footerTextStyle}>{brandName}</Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const bodyStyle = {
  margin: "0",
  padding: "28px 14px",
  backgroundColor: "#f7f1eb",
  color: "#2e241f",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const containerStyle = {
  width: "100%",
  maxWidth: "600px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
  border: "1px solid #eaded4",
  borderRadius: "18px",
};

const contentStyle = { padding: "28px 24px" };

const brandStyle = {
  margin: "0 0 12px",
  color: "#9e7f65",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "12px",
  lineHeight: "16px",
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
};

const titleStyle = {
  margin: "0 0 14px",
  color: "#1f1714",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "28px",
  lineHeight: "34px",
  fontWeight: "700",
};

const introStyle = {
  margin: "0 0 22px",
  color: "#5b4c44",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "16px",
  lineHeight: "25px",
};

const footerStyle = {
  marginTop: "28px",
  paddingTop: "16px",
  borderTop: "1px solid #eaded4",
};

const footerTextStyle = {
  margin: "0",
  color: "#8a7468",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "13px",
  lineHeight: "21px",
};
