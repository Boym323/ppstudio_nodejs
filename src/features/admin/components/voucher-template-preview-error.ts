const fallbackMessage = "Náhled se nepodařilo aktualizovat. Zkontrolujte layout a fitting textu.";

type VoucherTemplatePreviewError = {
  code: string | null;
  message: string;
  sampleText?: string;
};

/** Shared by the image preview and the test PDF download. */
export async function readVoucherTemplatePreviewError(response: Response): Promise<VoucherTemplatePreviewError> {
  const text = await response.text();
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return { code: null, message: text || fallbackMessage };
  }

  let error: { code?: unknown; message?: unknown; sampleText?: unknown } | null;
  try {
    error = JSON.parse(text);
  } catch {
    return { code: null, message: fallbackMessage };
  }
  const code = typeof error?.code === "string" ? error.code : null;
  const message = typeof error?.message === "string" ? error.message : fallbackMessage;
  if (code !== "text_overflow") return { code, message };

  const label = message.match(/do oblasti „(Hodnota|Služba|Platnost|Kód)“/)?.[1];
  return {
    code,
    ...(label === "Služba" && typeof error?.sampleText === "string" ? { sampleText: error.sampleText.slice(0, 500) } : {}),
    message: `${label ? `${label} se nevejde do vybrané oblasti.` : "Text se nevejde do vybrané oblasti."} Zvětšete oblast nebo snižte minimální velikost písma.`,
  };
}
