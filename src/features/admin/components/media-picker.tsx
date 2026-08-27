'use client';
import Image from 'next/image';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { searchMediaPickerAssetsAction } from '@/features/admin/actions/media-picker-actions';
import type { AdminArea } from '@/config/navigation';
import type { MediaPickerAssetSummary, MediaPickerScope } from '@/features/media/lib/media-picker-query';

export type MediaPickerAsset = MediaPickerAssetSummary;
export type MediaPickerProps = { area: AdminArea; enabled: boolean; scope: MediaPickerScope; value?: string | null; selectedAsset?: MediaPickerAsset | null; onSelect: (asset: MediaPickerAsset) => void; onUpload?: () => void };

export function MediaPicker({ area, enabled, scope, value, selectedAsset, onSelect, onUpload }: MediaPickerProps) {
  const pickerId = useId();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ items: MediaPickerAsset[]; page: number; pageCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [isPending, startTransition] = useTransition();
  const requestId = useRef(0);

  useEffect(() => { const timer = window.setTimeout(() => { setDebouncedQuery(query.trim()); setPage(1); }, 300); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => {
    if (!enabled) return;
    const currentRequest = ++requestId.current;
    startTransition(async () => {
      try {
        const response = await searchMediaPickerAssetsAction({ area, search: debouncedQuery, page, pageSize: 24, scope });
        if (currentRequest !== requestId.current) return;
        if (response.status === 'error') { setError(response.message); return; }
        setError(null);
        setResult(response.data);
      } catch { if (currentRequest === requestId.current) setError('Média se nepodařilo načíst.'); }
    });
  }, [area, debouncedQuery, enabled, page, retry, scope]);

  const selected = selectedAsset?.id === value ? selectedAsset : result?.items.find((asset) => asset.id === value) ?? null;
  const items = result?.items ?? [];
  const selectedDescriptionId = `${pickerId}-selected`;
  return <div className="space-y-3"><div className="flex gap-2"><label className="sr-only" htmlFor={`${pickerId}-search`}>Hledat média</label><input id={`${pickerId}-search`} value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} placeholder="Hledat název, soubor nebo alt text" className="min-h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"/>{onUpload ? <button type="button" onClick={onUpload} className="min-h-11 rounded-full border border-white/12 px-4 py-2 text-sm text-white">Nahrát</button> : null}</div>
    {selected ? <p id={selectedDescriptionId} className="rounded-lg bg-[rgba(190,160,120,0.12)] px-3 py-2 text-sm text-[var(--color-accent-soft)]">Vybráno: {selected.title ?? selected.fileName}</p> : null}
    {isPending && !result ? <p role="status" className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-sm text-white/60">Načítám média…</p> : error ? <div className="rounded-xl border border-red-300/20 px-4 py-3 text-sm text-red-200"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-2 min-h-11 rounded-full border border-white/15 px-4">Zkusit znovu</button></div> : items.length ? <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${isPending ? 'opacity-60' : ''}`} aria-busy={isPending}>{items.map((asset) => <button key={asset.id} type="button" onClick={() => onSelect(asset)} aria-pressed={asset.id === value} aria-describedby={asset.id === value && selected ? selectedDescriptionId : undefined} className={`relative min-h-11 overflow-hidden rounded-xl border text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] ${asset.id === value ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/35' : 'border-white/10'}`}>{asset.thumbnailPublicUrl ?? asset.publicUrl ? <div className="relative aspect-square"><Image src={asset.thumbnailPublicUrl ?? asset.publicUrl!} alt={asset.altText ?? asset.title ?? asset.fileName} fill className="object-cover" sizes="160px"/></div> : <div className="aspect-square bg-black/20"/>}{asset.id === value ? <span className="absolute right-2 top-2 rounded-full bg-[var(--color-accent)] px-2 py-1 text-[10px] font-semibold text-[var(--color-accent-contrast)]">Vybráno</span> : null}<span className="block truncate p-2 text-xs text-white">{asset.title ?? asset.fileName}</span></button>)}</div> : <p className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-sm text-white/60">{debouncedQuery ? 'Tomuto hledání neodpovídá žádné médium.' : 'Zatím nejsou dostupná žádná média.'}</p>}
    {result && !error ? <nav aria-label="Stránkování výběru médií" className="flex items-center justify-between gap-3 text-sm"><button type="button" disabled={isPending || result.page <= 1} onClick={() => setPage((value) => value - 1)} className="min-h-11 rounded-full border border-white/15 px-4 text-white disabled:cursor-not-allowed disabled:opacity-40">Předchozí</button><span className="text-white/60">Strana {result.page} z {result.pageCount}</span><button type="button" disabled={isPending || result.page >= result.pageCount} onClick={() => setPage((value) => value + 1)} className="min-h-11 rounded-full border border-white/15 px-4 text-white disabled:cursor-not-allowed disabled:opacity-40">Další</button></nav> : null}
  </div>;
}
export function selectedMediaAssetId(mediaAssetId: string) { return mediaAssetId; }
