"use client";

import { useState } from "react";
import Image from "next/image";

import type { VoucherTemplateLayoutV1 } from "@/features/vouchers/lib/voucher-template-layout";
import { VOUCHER_TEMPLATE_PREVIEW_QR } from "./voucher-template-layout-preview";
import { cn } from "@/lib/utils";

type PreviewMode = "VALUE" | "SERVICE" | "STOCK";
type AreaKey = "valueArea" | "serviceArea" | "validityArea" | "codeArea" | "qrArea";

const modeLabels: Record<PreviewMode, string> = {
  VALUE: "Hodnota",
  SERVICE: "Služba",
  STOCK: "Předtištěný",
};

const placeholderText: Record<Exclude<AreaKey, "qrArea">, string> = {
  valueArea: "1 500 Kč",
  serviceArea: "Korejský lash lifting",
  validityArea: "31. 12. 2027",
  codeArea: "PP-2026-ABC123",
};

export function VoucherTemplatePublishedPreview({ src, alt, layout }: { src?: string; alt: string; layout: VoucherTemplateLayoutV1 }) {
  const [mode, setMode] = useState<PreviewMode>("VALUE");
  const visibleAreas = getVisibleAreas(mode);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Placeholdery</span>
        {(Object.keys(modeLabels) as PreviewMode[]).map((option) => (
          <button key={option} type="button" onClick={() => setMode(option)} className={cn("inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition", mode === option ? "border-[var(--color-accent)]/60 bg-[var(--color-accent)] text-[var(--color-accent-contrast)]" : "border-white/10 bg-black/15 text-white/65 hover:border-white/25 hover:text-white")} aria-pressed={mode === option}>
            {modeLabels[option]}
          </button>
        ))}
      </div>
      <div className="relative aspect-[216/105] w-full overflow-hidden rounded-lg bg-white [container-type:inline-size]">
        {src ? <Image src={src} alt={alt} fill sizes="(min-width: 768px) 60vw, 100vw" unoptimized className="object-contain" /> : <div role="img" aria-label={alt} className="flex h-full items-center justify-center text-center text-xs text-black/50">Náhled šablony není dostupný.</div>}
        {visibleAreas.map((key) => {
          const area = layout[key];
          return <Placeholder key={key} area={area} label={key === "qrArea" ? "QR" : placeholderText[key]} isQr={key === "qrArea"} />;
        })}
      </div>
      <p className="mt-2 text-xs text-white/45">Placeholdery jsou pouze pro kontrolu umístění podle technických údajů layoutu.</p>
    </div>
  );
}

function getVisibleAreas(mode: PreviewMode): AreaKey[] {
  if (mode === "VALUE") return ["valueArea", "validityArea", "codeArea", "qrArea"];
  if (mode === "SERVICE") return ["serviceArea", "validityArea", "codeArea", "qrArea"];
  return ["codeArea", "qrArea"];
}

function Placeholder({ area, label, isQr }: { area: VoucherTemplateLayoutV1[AreaKey]; label: string; isQr: boolean }) {
  const typography = isQr || !("typography" in area) ? null : area.typography;
  const fontSize = `${Math.max(1.8, (typography?.preferredFontSizePt ?? 8) * 25.4 / 72 / 216 * 100)}cqw`;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute z-10 flex items-center justify-center overflow-hidden text-center font-semibold leading-none"
      style={{
        left: `${(area.xMm / 216) * 100}%`,
        top: `${((105 - area.yMm - area.heightMm) / 105) * 100}%`,
        width: `${(area.widthMm / 216) * 100}%`,
        height: `${(area.heightMm / 105) * 100}%`,
        fontSize,
        fontWeight: typography?.fontWeight === "bold" ? 700 : 400,
        textAlign: typography?.alignment ?? "center",
        color: typography ? cmykToCssRgb(typography.color) : undefined,
      }}
    >
      {isQr ? <QrPlaceholder /> : label}
    </span>
  );
}

function QrPlaceholder() {
  const modules = Array.from({ length: VOUCHER_TEMPLATE_PREVIEW_QR.totalModules ** 2 }, (_, index) => {
    const row = Math.floor(index / VOUCHER_TEMPLATE_PREVIEW_QR.totalModules);
    const column = index % VOUCHER_TEMPLATE_PREVIEW_QR.totalModules;
    return <span key={index} className={VOUCHER_TEMPLATE_PREVIEW_QR.isDark(row, column) ? "bg-[#1f1f1f]" : "bg-transparent"} />;
  });

  return <span aria-hidden="true" className="grid aspect-square h-full w-full" style={{ gridTemplateColumns: `repeat(${VOUCHER_TEMPLATE_PREVIEW_QR.totalModules}, minmax(0, 1fr))` }}>{modules}</span>;
}

function cmykToCssRgb(color: { c: number; m: number; y: number; k: number }) {
  const channel = (component: number) => Math.round(255 * (1 - component) * (1 - color.k));
  return `rgb(${channel(color.c)} ${channel(color.m)} ${channel(color.y)})`;
}
