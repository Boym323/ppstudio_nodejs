'use client';

import Image from 'next/image';
import { useId, useMemo, useState } from 'react';

export type MediaPickerAsset = { id: string; title: string | null; fileName: string; altText: string | null; thumbnailPublicUrl: string | null; publicUrl: string | null };
export type MediaPickerProps = { assets: MediaPickerAsset[]; value?: string | null; onSelect: (mediaAssetId: string) => void; onUpload?: () => void };

/** Single-select API; později lze rozšířit o value: string[] bez kopírování assetů. */
export function MediaPicker({ assets, value, onSelect, onUpload }: MediaPickerProps) {
  const pickerId = useId();
  const searchId = `${pickerId}-search`;
  const selectedId = `${pickerId}-selected`;
  const [query, setQuery] = useState('');
  const visible = useMemo(() => assets.filter((asset) => [asset.title, asset.fileName, asset.altText].some((text) => text?.toLocaleLowerCase('cs-CZ').includes(query.toLocaleLowerCase('cs-CZ')))), [assets, query]);
  const selected = assets.find((asset) => asset.id === value);
  return <div className="space-y-3"><div className="flex gap-2"><label className="sr-only" htmlFor={searchId}>Hledat média</label><input id={searchId} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hledat název, soubor nebo alt text" className="min-h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"/>{onUpload ? <button type="button" onClick={onUpload} className="min-h-11 rounded-full border border-white/12 px-4 py-2 text-sm text-white">Nahrát</button> : null}</div>{selected ? <p id={selectedId} className="rounded-lg bg-[rgba(190,160,120,0.12)] px-3 py-2 text-sm text-[var(--color-accent-soft)]">Vybráno: {selected.title ?? selected.fileName}</p> : null}{visible.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{visible.map((asset) => <button key={asset.id} type="button" onClick={() => onSelect(asset.id)} aria-pressed={asset.id === value} aria-describedby={asset.id === value && selected ? selectedId : undefined} className={`relative min-h-11 overflow-hidden rounded-xl border text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] ${asset.id === value ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/35' : 'border-white/10'}`}>{asset.thumbnailPublicUrl ?? asset.publicUrl ? <div className="relative aspect-square"><Image src={asset.thumbnailPublicUrl ?? asset.publicUrl!} alt={asset.altText ?? asset.title ?? asset.fileName} fill className="object-cover" sizes="160px"/></div> : <div className="aspect-square bg-black/20"/>}{asset.id === value ? <span className="absolute right-2 top-2 rounded-full bg-[var(--color-accent)] px-2 py-1 text-[10px] font-semibold text-[var(--color-accent-contrast)]">Vybráno</span> : null}<span className="block truncate p-2 text-xs text-white">{asset.title ?? asset.fileName}</span></button>)}</div> : <p className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-sm text-white/60">{query ? 'Tomuto hledání neodpovídá žádné médium.' : 'Zatím nejsou dostupná žádná média.'}</p>}</div>;
}

export function selectedMediaAssetId(mediaAssetId: string) { return mediaAssetId; }
