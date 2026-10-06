"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";

import { uploadVoucherTemplateMasterAction } from "@/features/admin/actions/voucher-template-actions";

export function VoucherTemplateGraphicsUpload({ templateId, hasGraphics }: { templateId: string; hasGraphics: boolean }) {
  return <form action={uploadVoucherTemplateMasterAction} className="mt-4">
    <input type="hidden" name="templateId" value={templateId} />
    <UploadButton />
    <p id="voucher-graphics-help" className="mt-2 text-xs text-white/65">PDF/X-4 · výsledný formát 210 × 99 mm · spadávka 3 mm</p>
    <p className="mt-1 text-xs text-white/45">Exportovaný soubor má 216 × 105 mm včetně spadávky. Maximálně 8 MB.</p>
    {hasGraphics ? <p className="mt-2 text-xs text-white/65">Před výměnou grafiky uložte změny umístění údajů. Po nahrání se editor otevře s uloženými údaji.</p> : null}
  </form>;
}

function UploadButton() {
  const { pending } = useFormStatus();
  const inputRef = useRef<HTMLInputElement>(null);

  return <>
    <input ref={inputRef} required name="master" type="file" accept="application/pdf,.pdf" className="hidden" disabled={pending}
      onChange={(event) => { if (event.currentTarget.files?.length) event.currentTarget.form?.requestSubmit(); }} />
    <button type="button" disabled={pending} aria-describedby="voucher-graphics-help" onClick={() => inputRef.current?.click()}
      className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.035] px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/25 hover:text-white disabled:cursor-wait disabled:opacity-50">
      {pending ? "Nahrávám a kontroluji grafiku…" : "Nahrát grafiku voucheru"}
    </button>
    <span role="status" className="sr-only">{pending ? "Nahrávám a kontroluji grafiku voucheru." : ""}</span>
  </>;
}
