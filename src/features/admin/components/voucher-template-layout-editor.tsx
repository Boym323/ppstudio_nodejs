"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Rnd } from "react-rnd";

import { saveVoucherTemplateLayoutAction } from "@/features/admin/actions/voucher-template-actions";
import {
  browserTopToPdfBottom,
  isVoucherTemplateTextAreaKey,
  pdfBottomToBrowserTop,
  updateTypography,
  voucherTemplateLayoutSchema,
  type VoucherTemplateLayoutV1,
  type VoucherTemplateTypographyPatch,
} from "@/features/vouchers/lib/voucher-template-layout";

import {
  createVoucherTemplatePreviewTextMeasurer,
  fitVoucherTemplatePreviewText,
  getVoucherTemplatePreviewBaselineTopPx,
  getVoucherTemplatePreviewFontSizePx,
  getVoucherTemplatePreviewLineBaselinePx,
  getVoucherTemplatePreviewText,
  isVoucherTemplatePreviewAreaVisible,
  VOUCHER_TEMPLATE_PREVIEW_FONT_FAMILIES,
  VOUCHER_TEMPLATE_PREVIEW_HORIZONTAL_PADDING_MM,
  type ServicePreviewScenario,
  type VoucherTemplatePreviewMode,
} from "./voucher-template-layout-preview";

const SCALE = 3;
const areas = ["valueArea", "serviceArea", "validityArea", "codeArea", "qrArea"] as const;
type AreaKey = (typeof areas)[number];
const labels: Record<AreaKey, string> = { valueArea: "VALUE", serviceArea: "SERVICE", validityArea: "VALIDITY", codeArea: "CODE", qrArea: "QR" };

export function VoucherTemplateLayoutEditor({ templateId, initialLayout, previewSrc }: { templateId: string; initialLayout: VoucherTemplateLayoutV1; previewSrc?: string }) {
  const [layout, setLayout] = useState(initialLayout);
  const [selected, setSelected] = useState<AreaKey>("valueArea");
  const [previewMode, setPreviewMode] = useState<VoucherTemplatePreviewMode>("VALUE");
  const [serviceScenario, setServiceScenario] = useState<ServicePreviewScenario>("normal");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [fontsReady, setFontsReady] = useState(false);
  const [fontMetricsVersion, setFontMetricsVersion] = useState(0);
  const previewTextMeasurer = useMemo(() => {
    void fontMetricsVersion;
    return createVoucherTemplatePreviewTextMeasurer(SCALE);
  }, [fontMetricsVersion]);
  const area = layout[selected];
  const textArea = isVoucherTemplateTextAreaKey(selected) ? layout[selected] : null;

  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts?.ready) {
      void Promise.resolve().then(() => setFontsReady(true));
      return;
    }

    let active = true;
    void document.fonts.ready.then(() => {
      if (active) {
        setFontsReady(true);
        setFontMetricsVersion((current) => current + 1);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const update = (key: AreaKey, patch: Record<string, unknown>) => setLayout((current) => ({ ...current, [key]: { ...current[key], ...patch } } as VoucherTemplateLayoutV1));
  const updateSelectedTypography = (patch: VoucherTemplateTypographyPatch) => {
    if (!isVoucherTemplateTextAreaKey(selected)) return;
    setLayout((current) => updateTypography(current, selected, patch));
  };
  const selectArea = (nextArea: AreaKey) => {
    setSelected(nextArea);
    if (nextArea === "valueArea") setPreviewMode("VALUE");
    if (nextArea === "serviceArea") setPreviewMode("SERVICE");
  };

  const save = () => {
    const parsed = voucherTemplateLayoutSchema.safeParse(layout);
    if (!parsed.success) {
      setSaveError(parsed.error.issues[0]?.message ?? "Layout šablony obsahuje neplatné hodnoty.");
      return;
    }

    startTransition(async () => {
      try {
        await saveVoucherTemplateLayoutAction(templateId, layout);
        setSaveError(null);
      } catch {
        setSaveError("Draft se nepodařilo uložit. Zkontrolujte hodnoty a zkuste to znovu.");
      }
    });
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_18rem]">
        <div>
          <div className="relative mx-auto max-w-[648px] overflow-hidden border border-white/40 bg-neutral-900" style={{ aspectRatio: "216 / 105" }}>
            {previewSrc ? <img src={previewSrc} alt="" aria-hidden="true" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain" /> : null}
            <div className="absolute inset-0 z-10">
              <div className="absolute border border-dashed border-amber-300/60" style={{ left: 3 * SCALE, bottom: 3 * SCALE, width: 210 * SCALE, height: 99 * SCALE }} />
              <div className="absolute left-1/2 top-0 h-full border-l border-dashed border-white/20" />
              <div className="absolute left-0 top-1/2 w-full border-t border-dashed border-white/20" />
              {areas.map((key) => {
                const item = layout[key];
                const baseline = "baselineMm" in item ? item.baselineMm : null;
                const previewVisible = isVoucherTemplatePreviewAreaVisible(key, previewMode);
                const textPreview = fontsReady && isVoucherTemplateTextAreaKey(key) && previewVisible
                  ? (() => {
                    const text = getVoucherTemplatePreviewText(key, serviceScenario);
                    const textAreaItem = item as VoucherTemplateLayoutV1["valueArea"];
                    const fit = fitVoucherTemplatePreviewText(text, textAreaItem, previewTextMeasurer);
                    return { text, fit };
                  })()
                  : null;
                const baselinePx = baseline === null ? null : getVoucherTemplatePreviewBaselineTopPx(item as VoucherTemplateLayoutV1["valueArea"], SCALE);
                const activeContent = key === "qrArea" || previewVisible;
                const inactiveAlternative = (key === "valueArea" || key === "serviceArea") && !previewVisible;

                return (
                  <Rnd
                    key={key}
                    bounds="parent"
                    size={{ width: item.widthMm * SCALE, height: item.heightMm * SCALE }}
                    position={{ x: item.xMm * SCALE, y: pdfBottomToBrowserTop(item.yMm, item.heightMm) * SCALE }}
                    lockAspectRatio={key === "qrArea"}
                    dragGrid={[SCALE / 2, SCALE / 2]}
                    resizeGrid={[SCALE / 2, SCALE / 2]}
                    onClick={() => selectArea(key)}
                    onDragStop={(_, data) => update(key, { xMm: data.x / SCALE, yMm: browserTopToPdfBottom(data.y / SCALE, item.heightMm) })}
                    onResizeStop={(_, __, ref, ___, pos) => {
                      const widthMm = ref.offsetWidth / SCALE;
                      const heightMm = ref.offsetHeight / SCALE;
                      update(key, { xMm: pos.x / SCALE, yMm: browserTopToPdfBottom(pos.y / SCALE, heightMm), widthMm, heightMm });
                    }}
                    className={`relative overflow-visible border ${selected === key ? "border-amber-300 bg-amber-300/20" : inactiveAlternative ? "border-white/20 bg-transparent" : "border-cyan-200/70 bg-cyan-200/10"}`}
                  >
                    {activeContent ? <span className="pointer-events-none absolute -top-4 right-1 z-20 rounded bg-black/65 px-1 py-0.5 text-[9px] font-bold leading-none tracking-[0.08em] text-white/90">{labels[key]}</span> : null}
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      {key === "qrArea" ? <PreviewQrPlaceholder /> : textPreview && baselinePx !== null ? <PreviewCanvas area={item as VoucherTemplateLayoutV1["valueArea"]} preview={textPreview} baselinePx={baselinePx} fontMetricsVersion={fontMetricsVersion} /> : null}
                      {baselinePx === null ? null : <span className="pointer-events-none absolute left-0 right-0 z-20 border-t border-red-300" style={{ top: `${baselinePx}px` }} />}
                    </div>
                  </Rnd>
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-xs text-white/55">Snap 0,5 mm · PDF souřadnice od levého spodního rohu · červená linka je baseline.</p>
        </div>

        <aside className="space-y-4">
          <label className="block text-sm">Preview režim<select value={previewMode} onChange={(event) => setPreviewMode(event.target.value as VoucherTemplatePreviewMode)} className="mt-1 w-full rounded bg-black/30 p-2"><option value="VALUE">Hodnota (VALUE)</option><option value="SERVICE">Služba (SERVICE)</option><option value="STOCK">Stock</option></select></label>

          <label className="block text-sm">Oblast<select value={selected} onChange={(event) => selectArea(event.target.value as AreaKey)} className="mt-1 w-full rounded bg-black/30 p-2">{areas.map((key) => <option key={key} value={key}>{labels[key]}</option>)}</select></label>

          {previewMode === "SERVICE" ? <section className="space-y-3 border-t border-white/10 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/55">Preview SERVICE</h3>
            <label className="block text-sm">Scénář<select value={serviceScenario} onChange={(event) => setServiceScenario(event.target.value as ServicePreviewScenario)} className="mt-1 w-full rounded bg-black/30 p-2"><option value="normal">Běžný název</option><option value="long">Dlouhý název</option></select></label>
            <p className="text-xs text-white/55">Scénář je pouze dočasné UI preview a neukládá se do layoutu.</p>
          </section> : null}

          <section className="space-y-3 border-t border-white/10 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/55">Pozice a velikost</h3>
            {(["xMm", "yMm", "widthMm", "heightMm"] as const).map((field) => <label key={field} className="block text-sm">{{ xMm: "X", yMm: "Y", widthMm: "Šířka", heightMm: "Výška" }[field]} (mm)<input type="number" step="0.5" value={area[field]} onChange={(event) => update(selected, { [field]: Number(event.target.value) })} className="mt-1 w-full rounded bg-black/30 p-2" /></label>)}
            {textArea ? <><label className="block text-sm">Baseline (mm)<input type="number" step="0.5" value={textArea.baselineMm} onChange={(event) => update(selected, { baselineMm: Number(event.target.value) })} className="mt-1 w-full rounded bg-black/30 p-2" /></label><label className="block text-sm">Max. řádků<input type="number" min="1" value={textArea.maxLines} onChange={(event) => update(selected, { maxLines: Number(event.target.value) })} className="mt-1 w-full rounded bg-black/30 p-2" /></label></> : null}
          </section>

          {textArea ? <section className="space-y-3 border-t border-white/10 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-white/55">Typografie</h3>
            <label className="block text-sm">Velikost písma (pt)<input type="number" step="0.1" min="0.1" max="144" value={textArea.typography.preferredFontSizePt} onChange={(event) => updateSelectedTypography({ preferredFontSizePt: Number(event.target.value) })} className="mt-1 w-full rounded bg-black/30 p-2" /></label>
            <label className="block text-sm">Minimální velikost písma (pt)<input type="number" step="0.1" min="0.1" max={textArea.typography.preferredFontSizePt} value={textArea.typography.minFontSizePt} onChange={(event) => updateSelectedTypography({ minFontSizePt: Number(event.target.value) })} className="mt-1 w-full rounded bg-black/30 p-2" /></label>
            <label className="block text-sm">Řádkování (mm)<input type="number" step="0.1" min="0" max="50" value={textArea.typography.lineHeightMm} onChange={(event) => updateSelectedTypography({ lineHeightMm: Number(event.target.value) })} className="mt-1 w-full rounded bg-black/30 p-2" /></label>
            <label className="block text-sm">Řez písma<select value={textArea.typography.fontWeight} onChange={(event) => updateSelectedTypography({ fontWeight: event.target.value as "regular" | "bold" })} className="mt-1 w-full rounded bg-black/30 p-2"><option value="regular">Regular</option><option value="bold">Bold</option></select></label>
            <label className="block text-sm">Zarovnání<select value={textArea.typography.alignment} onChange={(event) => updateSelectedTypography({ alignment: event.target.value as "left" | "center" })} className="mt-1 w-full rounded bg-black/30 p-2"><option value="left">Vlevo</option><option value="center">Na střed</option></select></label>
          </section> : null}

          {saveError ? <p role="alert" className="rounded border border-red-300/30 bg-red-950/30 p-2 text-sm text-red-200">{saveError}</p> : null}
          <button disabled={pending} onClick={save} className="w-full rounded-xl bg-[var(--color-accent)] px-4 py-2 font-semibold text-black disabled:opacity-50">{pending ? "Ukládám…" : "Uložit draft"}</button>
        </aside>
      </div>
    </section>
  );
}

function PreviewCanvas({ area, preview, baselinePx, fontMetricsVersion }: { area: VoucherTemplateLayoutV1["valueArea"]; preview: { text: string; fit: ReturnType<typeof fitVoucherTemplatePreviewText> }; baselinePx: number; fontMetricsVersion: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fontFamily = VOUCHER_TEMPLATE_PREVIEW_FONT_FAMILIES[area.typography.fontFamilyKey] ?? '"Noto Sans", sans-serif';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const widthPx = Math.max(1, area.widthMm * SCALE);
    const heightPx = Math.max(1, area.heightMm * SCALE);
    const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.style.width = `${widthPx}px`;
    canvas.style.height = `${heightPx}px`;
    canvas.width = Math.max(1, Math.round(widthPx * devicePixelRatio));
    canvas.height = Math.max(1, Math.round(heightPx * devicePixelRatio));
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.clearRect(0, 0, widthPx, heightPx);
    context.font = `${area.typography.fontWeight === "bold" ? 700 : 400} ${getVoucherTemplatePreviewFontSizePx(preview.fit.fontSizePt, SCALE)}px ${fontFamily}`;
    context.textBaseline = "alphabetic";
    context.textAlign = area.typography.alignment;
    context.fillStyle = "#2e241f";

    const x = area.typography.alignment === "center"
      ? widthPx / 2
      : VOUCHER_TEMPLATE_PREVIEW_HORIZONTAL_PADDING_MM * SCALE / 2;
    preview.fit.lines.forEach((line, index) => {
      const lineBaselinePx = getVoucherTemplatePreviewLineBaselinePx(baselinePx, preview.fit.lines.length, index, preview.fit.lineHeightMm, SCALE);
      context.fillText(line, x, lineBaselinePx);
    });
  }, [area, baselinePx, fontFamily, fontMetricsVersion, preview]);

  return <canvas
    ref={canvasRef}
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 z-10"
    data-preview-text={preview.text}
  />;
}

function PreviewQrPlaceholder() {
  return <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-2">
    <div className="grid aspect-square w-3/4 grid-cols-5 gap-px bg-white/70 p-0.5 opacity-80">
      {Array.from({ length: 25 }, (_, index) => <span key={index} className={(index * 7 + index % 3) % 5 < 2 ? "bg-black" : "bg-transparent"} />)}
    </div>
  </div>;
}
