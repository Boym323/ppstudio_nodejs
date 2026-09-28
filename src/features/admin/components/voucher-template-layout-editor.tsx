"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent, type MouseEvent } from "react";
import Image from "next/image";
import { Rnd } from "react-rnd";

import { saveVoucherTemplateLayoutAction } from "@/features/admin/actions/voucher-template-actions";
import { constrainAreaToTrim, getBaselineWithPreservedTopOffset, getLockedResizeSize, getResizeAnchor, snapToHalfMm } from "./voucher-template-layout-editor-geometry";
import { getVoucherEditorOverlayState } from "./voucher-template-layout-editor-overlays";
import {
  browserTopToPdfBottom,
  isVoucherTemplateTextAreaKey,
  pdfBottomToBrowserTop,
  updateTypography,
  voucherTemplateLayoutSchema,
  VOUCHER_QR_MIN_SIZE_MM,
  type VoucherTemplateTextAreaKey,
  type VoucherTemplateLayoutV1,
  type VoucherTemplateTypographyPatch,
} from "@/features/vouchers/lib/voucher-template-layout";
import { VOUCHER_TEMPLATE_PREVIEW_FONT_FAMILIES } from "./voucher-template-layout-preview";

const areas = ["valueArea", "serviceArea", "validityArea", "codeArea", "qrArea"] as const;
type AreaKey = (typeof areas)[number];
type EditableArea = VoucherTemplateLayoutV1[AreaKey];
type ResizeStart = { key: AreaKey; area: EditableArea; direction: string };

const labels: Record<AreaKey, string> = { valueArea: "Hodnota", serviceArea: "Služba", validityArea: "Platnost", codeArea: "Kód", qrArea: "QR kód" };
const shortLabels: Record<AreaKey, string> = { valueArea: "Hodnota", serviceArea: "Služba", validityArea: "Platnost", codeArea: "Kód", qrArea: "QR" };
const fieldLabels = { xMm: "X", yMm: "Y", widthMm: "Šířka", heightMm: "Výška" } as const;
const inputClassName = "mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[var(--color-accent)]/70 focus:ring-2 focus:ring-[var(--color-accent)]/15";
const compactButtonClassName = "inline-flex min-h-9 items-center justify-center rounded-full border px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/70";
const MIN_TEXT_AREA_MM = 0.5;
const KEYBOARD_NUDGE_MM = 0.1;
const KEYBOARD_NUDGE_LARGE_MM = 1;
const cornerResizeEnable = { top: false, right: false, bottom: false, left: false, topRight: true, bottomRight: true, bottomLeft: true, topLeft: true } as const;

function isAspectRatioLocked(key: AreaKey) { return key === "qrArea"; }
function minimumSizeMm(key: AreaKey) { return isAspectRatioLocked(key) ? VOUCHER_QR_MIN_SIZE_MM : MIN_TEXT_AREA_MM; }

export function VoucherTemplateLayoutEditor({ templateId, initialLayout, initialUpdatedAt, previewSrc }: { templateId: string; initialLayout: VoucherTemplateLayoutV1; initialUpdatedAt: string; previewSrc?: string }) {
  const [layout, setLayout] = useState(initialLayout);
  const layoutRef = useRef(initialLayout);
  const [revision, setRevision] = useState(initialUpdatedAt);
  const [selected, setSelected] = useState<AreaKey | null>("valueArea");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testPdfError, setTestPdfError] = useState<string | null>(null);
  const [testPdfPending, setTestPdfPending] = useState(false);
  const [pending, startTransition] = useTransition();
  const [showGuides, setShowGuides] = useState(true);
  const [showBleed, setShowBleed] = useState(true);
  const [isInteracting, setIsInteracting] = useState(false);
  const [renderedPreview, setRenderedPreviewSrc] = useState<{ src: string; layout: VoucherTemplateLayoutV1; previewType: string } | null>(null);
  const [previewFailure, setPreviewFailure] = useState<{ layout: VoucherTemplateLayoutV1; previewType: string; message: string } | null>(null);
  const canvasStageRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 648, height: 315 });
  const resizeStartRef = useRef<ResizeStart | null>(null);
  const canvasScale = canvasSize.width / 216;
  const area = selected === null ? layout.valueArea : layout[selected];
  const textArea = selected !== null && isVoucherTemplateTextAreaKey(selected) ? layout[selected] : null;
  const overlayState = getVoucherEditorOverlayState({ showGuides, showBleed, isInteracting });
  const previewType = selected === "serviceArea" ? "SERVICE" : "VALUE";

  useEffect(() => {
    if (isInteracting) return;

    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/admin/voucher-templates/${templateId}/test-pdf?format=preview&previewType=${previewType}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ layout }),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!response.ok) throw new Error(await response.text());
        const nextUrl = URL.createObjectURL(await response.blob());
        if (controller.signal.aborted) {
          URL.revokeObjectURL(nextUrl);
          return;
        }
        setRenderedPreviewSrc((current) => {
          if (current) URL.revokeObjectURL(current.src);
          return { src: nextUrl, layout, previewType };
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          setPreviewFailure({ layout, previewType, message: error instanceof Error ? error.message : "Náhled se nepodařilo aktualizovat." });
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [isInteracting, layout, previewType, templateId]);

  useEffect(() => () => {
    if (renderedPreview) URL.revokeObjectURL(renderedPreview.src);
  }, [renderedPreview]);

  const hasRenderedPreview = renderedPreview?.layout === layout && renderedPreview.previewType === previewType;
  const displayedPreviewSrc = hasRenderedPreview ? renderedPreview.src : previewSrc;
  const previewError = !hasRenderedPreview && previewFailure?.layout === layout && previewFailure.previewType === previewType ? previewFailure.message : null;

  useEffect(() => {
    const stage = canvasStageRef.current;
    if (!stage) return;

    const measure = () => {
      const styles = window.getComputedStyle(stage);
      const horizontalPadding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
      const verticalPadding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
      const availableWidth = Math.max(280, stage.clientWidth - horizontalPadding);
      const availableHeight = Math.max(180, stage.clientHeight - verticalPadding);
      const width = Math.min(780, availableWidth, availableHeight * (216 / 105));
      const height = width * (105 / 216);

      setCanvasSize((current) => Math.abs(current.width - width) < 0.5 ? current : { width, height });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const update = (key: AreaKey, patch: Record<string, unknown>) => {
    const current = layoutRef.current;
    const next = { ...current, [key]: { ...current[key], ...patch } } as VoucherTemplateLayoutV1;
    layoutRef.current = next;
    setLayout(next);
  };
  const updateAreaField = (key: AreaKey, field: "xMm" | "yMm" | "widthMm" | "heightMm", value: number) => {
    if (key === "qrArea" && (field === "widthMm" || field === "heightMm")) {
      const sizeMm = Number.isFinite(value) ? Math.max(VOUCHER_QR_MIN_SIZE_MM, snapToHalfMm(value)) : value;
      update(key, { widthMm: sizeMm, heightMm: sizeMm });
      return;
    }
    if (isVoucherTemplateTextAreaKey(key) && (field === "yMm" || field === "heightMm")) {
      const current = layoutRef.current[key] as VoucherTemplateLayoutV1[VoucherTemplateTextAreaKey];
      const nextYmm = field === "yMm" ? value : current.yMm;
      const nextHeightMm = field === "heightMm" ? value : current.heightMm;
      update(key, { [field]: value, baselineMm: getBaselineWithPreservedTopOffset(current, nextYmm, nextHeightMm) });
      return;
    }
    update(key, { [field]: value });
  };
  const updateSelectedTypography = (patch: VoucherTemplateTypographyPatch) => {
    if (selected === null || !isVoucherTemplateTextAreaKey(selected)) return;
    const next = updateTypography(layoutRef.current, selected, patch);
    layoutRef.current = next;
    setLayout(next);
  };

  const applyResize = (key: AreaKey, direction: string, elementRef: HTMLElement, position: { x: number; y: number }) => {
    const start = resizeStartRef.current?.key === key ? resizeStartRef.current.area : layout[key];
    const scale = canvasScale;
    const measuredWidthMm = snapToHalfMm(elementRef.getBoundingClientRect().width / scale);
    const measuredHeightMm = snapToHalfMm(elementRef.getBoundingClientRect().height / scale);
    const minimumMm = minimumSizeMm(key);
    const maxWidthMm = direction.endsWith("Left") ? start.xMm + start.widthMm - 3 : 213 - start.xMm;
    const maxHeightMm = direction.startsWith("top") ? 102 - start.yMm : start.yMm + start.heightMm - 3;
    const widthMm = isAspectRatioLocked(key)
      ? Math.min(maxWidthMm, maxHeightMm, getLockedResizeSize(measuredWidthMm, measuredHeightMm, minimumMm))
      : Math.min(maxWidthMm, Math.max(minimumMm, measuredWidthMm));
    const heightMm = isAspectRatioLocked(key) ? widthMm : Math.min(maxHeightMm, Math.max(minimumMm, measuredHeightMm));
    const anchor = getResizeAnchor(start, direction, widthMm, heightMm);
    const fallbackPosition = { xMm: position.x / scale, yMm: browserTopToPdfBottom(position.y / scale, heightMm) };
    const constrained = constrainAreaToTrim({
      xMm: anchor?.xMm ?? snapToHalfMm(fallbackPosition.xMm),
      yMm: anchor?.yMm ?? snapToHalfMm(fallbackPosition.yMm),
      widthMm, heightMm,
    });
    const baselineArea = isVoucherTemplateTextAreaKey(key) ? start as VoucherTemplateLayoutV1[VoucherTemplateTextAreaKey] : null;

    update(key, {
      ...constrained,
      ...(baselineArea ? { baselineMm: getBaselineWithPreservedTopOffset(baselineArea, constrained.yMm, constrained.heightMm) } : {}),
    });
  };
  const selectArea = (nextArea: AreaKey) => {
    setSelected(nextArea);
  };
  const nudgeAreaByKeyboard = (event: KeyboardEvent<HTMLDivElement>, key: AreaKey) => {
    const direction = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1],
    }[event.key];
    if (!direction) return;

    event.preventDefault();
    const item = layoutRef.current[key];
    const step = event.shiftKey ? KEYBOARD_NUDGE_LARGE_MM : KEYBOARD_NUDGE_MM;
    const [horizontal, vertical] = direction;
    const xMm = Math.min(213 - item.widthMm, Math.max(3, item.xMm + horizontal * step));
    const yMm = Math.min(102 - item.heightMm, Math.max(3, item.yMm + vertical * step));
    const baselineArea = isVoucherTemplateTextAreaKey(key) ? item as VoucherTemplateLayoutV1[VoucherTemplateTextAreaKey] : null;

    update(key, {
      xMm,
      yMm,
      ...(baselineArea ? { baselineMm: getBaselineWithPreservedTopOffset(baselineArea, yMm, item.heightMm) } : {}),
    });
  };

  const save = () => {
    const currentLayout = layoutRef.current;
    const parsed = voucherTemplateLayoutSchema.safeParse(currentLayout);
    if (!parsed.success) {
      setSaveError(parsed.error.issues[0]?.message ?? "Layout šablony obsahuje neplatné hodnoty.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await saveVoucherTemplateLayoutAction(templateId, currentLayout, revision);
        setRevision(result.updatedAt);
        setSaveError(null);
      } catch {
        setSaveError("Draft se nepodařilo uložit. Mohl být změněn v jiném okně; obnovte stránku a zkuste to znovu.");
      }
    });
  };

  const downloadTestPdf = async () => {
    setTestPdfPending(true);
    setTestPdfError(null);
    try {
      const response = await fetch(`/api/admin/voucher-templates/${templateId}/test-pdf?previewType=${previewType}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ layout: layoutRef.current }),
      });
      if (!response.ok) throw new Error(await response.text());
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "voucher-TEST-2026-ABCDEF-tiskove.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      setTestPdfError(error instanceof Error && error.message ? error.message : "Zkušební PDF se nepodařilo stáhnout.");
    } finally {
      setTestPdfPending(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-[var(--radius-panel)] border border-white/10 bg-black/10 shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
      <div className="border-b border-white/10 bg-white/[0.035] px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent-soft)]">Editor layoutu</p><h3 className="mt-1 font-display text-xl text-white sm:text-2xl">Pracovní plocha</h3></div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/65"><span className="rounded-full border border-white/10 bg-black/15 px-3 py-2">216 × 105 mm</span><span className="rounded-full border border-white/10 bg-black/15 px-3 py-2">Snap 0,5 mm</span></div>
        </div>
        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">Prvek</p>
              <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Editovaná oblast">{areas.map((key) => <button key={key} type="button" role="tab" aria-selected={selected === key} onClick={() => selectArea(key)} className={`${compactButtonClassName} shrink-0 ${selected === key ? "border-[var(--color-accent)]/60 bg-[rgba(190,160,120,0.16)] text-[var(--color-accent-soft)]" : "border-white/10 text-white/60 hover:border-white/20 hover:text-white"}`}>{shortLabels[key]}</button>)}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/70 xl:ml-auto"><ToggleButton label="Vodítka" checked={showGuides} onClick={() => setShowGuides((current) => !current)} /><ToggleButton label="Spadávka" checked={showBleed} onClick={() => setShowBleed((current) => !current)} /></div>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 p-4 sm:p-6 xl:border-r xl:border-white/10">
          <div ref={canvasStageRef} className="flex min-h-[360px] items-center justify-center rounded-2xl border border-white/8 bg-[#0b0a0c] p-4 shadow-inner sm:min-h-[480px] sm:p-8">
            <div className="relative shrink-0 overflow-visible border border-white/20 bg-neutral-900 shadow-[0_18px_50px_rgba(0,0,0,0.28)]" style={{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px` }}>
              {displayedPreviewSrc ? <Image src={displayedPreviewSrc} alt={hasRenderedPreview ? "Náhled výsledného voucheru" : "Náhled master PDF voucheru"} fill sizes="(min-width: 1280px) 780px, 100vw" unoptimized draggable={false} className="pointer-events-none select-none object-contain" /> : null}
              <div className="absolute inset-0 z-10" onClick={() => setSelected(null)}>
                {overlayState.bleedVisible ? <div data-overlay="bleed" className="pointer-events-none absolute z-10 border border-dashed border-[var(--color-accent-soft)]/65" style={{ left: 3 * canvasScale, bottom: 3 * canvasScale, width: 210 * canvasScale, height: 99 * canvasScale }} /> : null}
                {overlayState.guidesVisible ? <><div data-overlay="guides" className={`pointer-events-none absolute left-1/2 top-0 z-10 h-full border-l border-dashed ${overlayState.guidesEmphasized ? "border-[var(--color-accent-soft)]/75" : "border-white/20"}`} /><div className={`pointer-events-none absolute left-0 top-1/2 z-10 w-full border-t border-dashed ${overlayState.guidesEmphasized ? "border-[var(--color-accent-soft)]/75" : "border-white/20"}`} /></> : null}
                {areas.map((key) => {
                  const item = layout[key];
                  const isSelected = selected === key;
                  const isQrArea = key === "qrArea";
                  return <Rnd
                    key={key}
                    bounds="parent"
                    size={{ width: item.widthMm * canvasScale, height: item.heightMm * canvasScale }}
                    position={{ x: item.xMm * canvasScale, y: pdfBottomToBrowserTop(item.yMm, item.heightMm) * canvasScale }}
                    lockAspectRatio={isAspectRatioLocked(key)}
                    minWidth={minimumSizeMm(key) * canvasScale}
                    minHeight={minimumSizeMm(key) * canvasScale}
                    enableResizing={isSelected ? cornerResizeEnable : false}
                    dragGrid={[canvasScale / 2, canvasScale / 2]}
                    resizeGrid={[canvasScale / 2, canvasScale / 2]}
                    tabIndex={0}
                    role="button"
                    aria-label={`${labels[key]}. Šipkami posunete o 0,1 mm, se Shiftem o 1 mm.`}
                    onClick={(event: MouseEvent) => { event.stopPropagation(); selectArea(key); }}
                    onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => nudgeAreaByKeyboard(event, key)}
                    onDragStart={() => { selectArea(key); setIsInteracting(true); }}
                    onResizeStart={(_, direction) => { resizeStartRef.current = { key, area: item, direction }; selectArea(key); setIsInteracting(true); }}
                    onResize={(_, direction, ref, __, pos) => applyResize(key, direction, ref, pos)}
                    onDragStop={(_, data) => {
                      setIsInteracting(false);
                      const constrained = constrainAreaToTrim({ ...item, xMm: snapToHalfMm(data.x / canvasScale), yMm: snapToHalfMm(browserTopToPdfBottom(data.y / canvasScale, item.heightMm)) });
                      const baselineArea = isVoucherTemplateTextAreaKey(key) ? item as VoucherTemplateLayoutV1[VoucherTemplateTextAreaKey] : null;
                      update(key, {
                        ...constrained,
                        ...(baselineArea ? { baselineMm: getBaselineWithPreservedTopOffset(baselineArea, constrained.yMm, constrained.heightMm) } : {}),
                      });
                    }}
                    onResizeStop={(_, direction, ref, __, pos) => { setIsInteracting(false); applyResize(key, direction, ref, pos); resizeStartRef.current = null; }}
                    resizeHandleStyles={cornerHandleStyles}
                    className={`group relative cursor-move overflow-visible border transition-colors ${isSelected ? `${isQrArea ? "z-20 border border-dashed border-[var(--color-accent-soft)]" : "z-20 border border-[var(--color-accent-soft)]"} outline outline-1 outline-offset-1 outline-[var(--color-accent)]/55` : "border-white/8 bg-transparent hover:border-white/40"}`}
                  >
                    {isSelected ? <span className="pointer-events-none absolute -top-6 left-0 z-20 rounded-md border border-[var(--color-accent)]/50 bg-[#1c1714] px-1.5 py-1 text-[9px] font-bold leading-none tracking-[0.08em] text-[var(--color-accent-soft)]">{isQrArea ? "QR kód" : labels[key]}</span> : <span className="pointer-events-none absolute -top-5 left-0 z-20 rounded-md border border-white/10 bg-black/75 px-1.5 py-1 text-[9px] font-bold leading-none tracking-[0.08em] text-white/70 opacity-0 transition-opacity group-hover:opacity-100">{shortLabels[key]}</span>}
                    <div className="pointer-events-none absolute inset-0 overflow-hidden" />
                  </Rnd>;
                })}
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/50"><span className="inline-flex items-center gap-1.5" title="PDF souřadnice se počítají od levého spodního rohu."><span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/20 text-[10px]">?</span><span>Souřadnice PDF</span></span><span>{showBleed ? "Spadávka 3 mm" : "Spadávka skrytá"}</span></div>
        </div>

        <aside className="min-w-0 bg-white/[0.02] p-4 sm:p-6">
          {selected === null ? <div className="flex min-h-48 flex-col items-center justify-center text-center"><p className="text-sm font-semibold text-white/80">Nic není vybráno</p><p className="mt-2 max-w-xs text-xs leading-5 text-white/45">Kliknutím na prázdné místo jste zrušili výběr. Pro úpravu klikněte na oblast voucheru.</p></div> : <>
          <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">Upravujete</p><h3 className="mt-1 text-lg font-semibold text-white">{labels[selected]}</h3></div><span className="rounded-lg border border-white/10 bg-black/15 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/50">{selected === "qrArea" ? "Grafika" : "Textová oblast"}</span></div>
          <section className="border-b border-white/10 py-3"><SectionTitle title="Pozice a rozměry" /><div className="grid grid-cols-2 gap-3">{(["xMm", "yMm", "widthMm", "heightMm"] as const).map((field) => <NumberField key={field} label={`${fieldLabels[field]} (mm)`} value={area[field]} min={field === "xMm" || field === "yMm" ? 0 : minimumSizeMm(selected)} onChange={(value) => updateAreaField(selected, field, value)} />)}</div></section>
          {textArea ? <section className="border-b border-white/10 py-3"><SectionTitle title="Typografie" /><label className="block text-xs text-white/70">Písmo<select value={textArea.typography.fontFamilyKey} onChange={(event) => updateSelectedTypography({ fontFamilyKey: event.target.value })} className={inputClassName}>{Object.keys(VOUCHER_TEMPLATE_PREVIEW_FONT_FAMILIES).map((key) => <option key={key} value={key} className="text-black">{key === "noto-sans" ? "Noto Sans" : key}</option>)}</select></label><div className="mt-3 grid grid-cols-2 gap-3"><label className="block text-xs text-white/70">Řez<select value={textArea.typography.fontWeight} onChange={(event) => updateSelectedTypography({ fontWeight: event.target.value as "regular" | "bold" })} className={inputClassName}><option value="regular" className="text-black">Regular</option><option value="bold" className="text-black">Bold</option></select></label><NumberField label="Velikost (pt)" value={textArea.typography.preferredFontSizePt} step="0.1" onChange={(value) => updateSelectedTypography({ preferredFontSizePt: value })} /></div><label className="mt-3 block text-xs text-white/70">Zarovnání<select value={textArea.typography.alignment} onChange={(event) => updateSelectedTypography({ alignment: event.target.value as "left" | "center" })} className={inputClassName}><option value="left" className="text-black">Vlevo</option><option value="center" className="text-black">Na střed</option></select></label></section> : null}
          {textArea ? <details className="border-b border-white/10 py-3"><summary className="cursor-pointer list-none text-sm font-semibold text-white marker:hidden">Pokročilé nastavení <span className="float-right text-white/45">⌄</span></summary><div className="mt-3 grid gap-3"><NumberField label="Baseline (mm)" value={textArea.baselineMm} step="0.5" onChange={(value) => update(selected, { baselineMm: value })} /><div className="grid grid-cols-2 gap-3"><NumberField label="Min. velikost (pt)" value={textArea.typography.minFontSizePt} step="0.1" onChange={(value) => updateSelectedTypography({ minFontSizePt: value })} /><NumberField label="Max. řádků" value={textArea.maxLines} step="1" onChange={(value) => update(selected, { maxLines: value })} /></div><NumberField label="Řádkování (mm)" value={textArea.typography.lineHeightMm} step="0.1" onChange={(value) => updateSelectedTypography({ lineHeightMm: value })} /><p className="text-xs leading-5 text-white/45">Baseline, minimální velikost a řádkování ovlivňují fitting textu v PDF.</p></div></details> : null}
          </>}
          {previewError ? <p role="alert" className="mt-3 rounded-xl border border-red-300/30 bg-red-950/30 p-3 text-sm text-red-200">Náhled není aktuální: {previewError}</p> : null}
          {!hasRenderedPreview && !previewError ? <p role="status" className="mt-3 text-xs text-white/60">Aktualizuji náhled…</p> : null}
          {saveError ? <p role="alert" className="mt-3 rounded-xl border border-red-300/30 bg-red-950/30 p-3 text-sm text-red-200">{saveError}</p> : null}
          {testPdfError ? <p role="alert" className="mt-3 rounded-xl border border-red-300/30 bg-red-950/30 p-3 text-sm text-red-200">{testPdfError}</p> : null}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={testPdfPending || pending} onClick={downloadTestPdf} className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:text-white disabled:cursor-wait disabled:opacity-50">{testPdfPending ? "Připravuji PDF…" : "Stáhnout testovací PDF"}</button>
            <button type="button" disabled={pending || testPdfPending} onClick={save} className="inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-50">{pending ? "Ukládám změny…" : "Uložit změny"}</button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function SectionTitle({ title }: { title: string }) { return <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/60">{title}</h4>; }
function NumberField({ label, value, step = "0.5", min, onChange }: { label: string; value: number; step?: string; min?: number; onChange: (value: number) => void }) { return <label className="block min-w-0 text-xs text-white/70">{label}<input type="number" value={formatNumericValue(value, step)} step={step} min={min} onChange={(event) => onChange(Number(event.target.value))} className={`${inputClassName} tabular-nums`} /></label>; }
function formatNumericValue(value: number, step: string) {
  if (!Number.isFinite(value)) return "";
  const decimals = step === "1" ? 0 : 1;
  return value.toFixed(decimals).replace(/\.0+$/, "");
}
function ToggleButton({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) { return <button type="button" aria-pressed={checked} onClick={onClick} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/70"><span>{label}</span><span className={`rounded-full px-1.5 py-0.5 text-[9px] tracking-[0.12em] ${checked ? "bg-[var(--color-accent)] text-[var(--color-accent-contrast)]" : "bg-white/10 text-white/45"}`}>{checked ? "ON" : "OFF"}</span></button>; }
const handleStyle = { width: 6, height: 6, borderRadius: 2, background: "#dbc2a5", border: "1px solid #171311", boxShadow: "0 0 0 1px rgba(135,105,65,.4)" };
const cornerHandleStyles = { topLeft: { ...handleStyle, cursor: "nwse-resize" }, topRight: { ...handleStyle, cursor: "nesw-resize" }, bottomLeft: { ...handleStyle, cursor: "nesw-resize" }, bottomRight: { ...handleStyle, cursor: "nwse-resize" } };
