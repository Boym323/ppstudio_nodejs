// Presentation only: the existing PDF preflight remains the source of validation errors.
export function voucherTemplateUploadErrorMessage(message: string): string {
  if (message.startsWith("PDF nemá požadovanou geometrii")) return "PDF nemá správný rozměr nebo spadávku. Očekává se výsledný formát 210 × 99 mm se spadávkou 3 mm na každé straně (soubor 216 × 105 mm).";
  if (message.startsWith("PDF verze ") || message === "PDF nemá katalogová PDF/X XMP metadata." || message === "PDF/X XMP metadata nedeklarují PDF/X-4." || message === "PDF Info dictionary nesmí obsahovat GTS_PDFXConformance pro PDF/X-4.") return "PDF není správně exportované jako PDF/X-4. V Affinity zvolte export PDF/X-4 a nahrajte soubor znovu.";
  if ((message === "PDF nemá dokumentový OutputIntent." || message.startsWith("PDF má neúplný OutputIntent;")) || message === "PDF nemá DestOutputProfile/ICC profil." || message === "DestOutputProfile není platný ICC stream.") return "PDF nemá požadovaný tiskový profil nebo je profil neplatný. Exportujte PDF/X-4 s vloženým CMYK ICC profilem (OutputIntent).";
  if (message.startsWith("Master má mít 1 stránku,")) return "PDF musí obsahovat právě jednu stránku s grafikou voucheru.";
  if (message === "Master musí být platný PDF soubor." || message === "Master PDF není platný.") return "Soubor není platné PDF. Nahrajte PDF/X-4 exportované z Affinity.";
  if (message === "Vyberte PDF master do 8 MB.") return "Vyberte grafiku voucheru ve formátu PDF, maximálně 8 MB.";
  if (message === "PDF master se nepodařilo nahrát.") return "Grafiku voucheru se nepodařilo nahrát. Zkuste to znovu.";
  return message;
}
