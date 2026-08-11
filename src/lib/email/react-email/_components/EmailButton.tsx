import { Button } from "react-email";

export function EmailButton({ href, label, variant = "primary" }: { href: string; label: string; variant?: "primary" | "secondary" | "destructive" }) {
  return <Button href={href} style={variant === "secondary" ? secondaryStyle : variant === "destructive" ? destructiveStyle : primaryStyle}>{label}</Button>;
}

const primaryStyle = { display: "inline-block", padding: "12px 18px", borderRadius: "8px", backgroundColor: "#1f1714", color: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "14px", lineHeight: "20px", fontWeight: "700", textDecoration: "none" };
const secondaryStyle = { display: "inline-block", padding: "12px 18px", borderRadius: "8px", backgroundColor: "#fffaf6", border: "1px solid #cdb8a8", color: "#1f1714", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "14px", lineHeight: "20px", fontWeight: "700", textDecoration: "none" };
const destructiveStyle = { display: "inline-block", padding: "12px 18px", borderRadius: "8px", backgroundColor: "#fff7f5", border: "1px solid #f0d4cf", color: "#9f2f24", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "14px", lineHeight: "20px", fontWeight: "700", textDecoration: "none" };
