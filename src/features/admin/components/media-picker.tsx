'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';

export type MediaPickerAsset = { id: string; title: string | null; fileName: string; altText: string | null; thumbnailPublicUrl: string | null; publicUrl: string | null };
export type MediaPickerProps = { assets: MediaPickerAsset[]; value?: string | null; onSelect: (mediaAssetId: string) => void; onUpload?: () => void };

/** Single-select API; později lze rozšířit o value: string[] bez kopírování assetů. */
export function MediaPicker({ assets, value, onSelect, onUpload }: MediaPickerProps) {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => assets.filter((asset) => [asset.title, asset.fileName, asset.altText].some((text) => text?.toLocaleLowerCase('cs-CZ').includes(query.toLocaleLowerCase('cs-CZ')))), [assets, query]);
  const selected = assets.find((asset) => asset.id === value);
  return <div className="space-y-3"><div className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hledat média" className="min-w-0 flex-1 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white"/>{onUpload ? <button type="button" onClick={onUpload} className="rounded-full border border-white/12 px-4 py-2 text-sm text-white">Nahrát</button> : null}</div>{selected ? <p className="text-sm text-[var(--color-accent-soft)]">Vybráno: {selected.title ?? selected.fileName}</p> : null}<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{visible.map((asset) => <button key={asset.id} type="button" onClick={() => onSelect(asset.id)} aria-pressed={asset.id === value} className={`overflow-hidden rounded-xl border text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] ${asset.id === value ? 'border-[var(--color-accent)]' : 'border-white/10'}`}>{asset.thumbnailPublicUrl ?? asset.publicUrl ? <div className="relative aspect-square"><Image src={asset.thumbnailPublicUrl ?? asset.publicUrl!} alt={asset.altText ?? asset.title ?? asset.fileName} fill className="object-cover" sizes="160px"/></div> : <div className="aspect-square bg-black/20"/>}<span className="block truncate p-2 text-xs text-white">{asset.title ?? asset.fileName}</span></button>)}</div></div>;
}

export function selectedMediaAssetId(mediaAssetId: string) { return mediaAssetId; }
