'use client';

import Image from 'next/image';
import { useState } from 'react';

import { addReferenceMediaAction, moveReferenceMediaAction, removeReferenceMediaAction, updateReferenceMediaAction } from '@/features/admin/actions/reference-media-actions';
import { MediaPicker, type MediaPickerAsset } from '@/features/admin/components/media-picker';
import { PendingSubmitButton } from '@/features/admin/components/pending-submit-button';
import { type AdminArea } from '@/config/navigation';

export type ReferenceMediaItem = {
  id: string;
  mediaAssetId: string;
  sortOrder: number;
  isVisible: boolean;
  altText: string | null;
  caption: string | null;
  mediaAsset: MediaPickerAsset;
};

export function ReferenceMediaSection({ area, assets, items }: { area: AdminArea; assets: MediaPickerAsset[]; items: ReferenceMediaItem[] }) {
  const [selectedId, setSelectedId] = useState('');
  return <section className="mb-5 space-y-4 rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
    <div><h2 className="text-lg font-semibold text-white">Reference</h2><p className="mt-1 text-sm text-white/60">Vyberte existující asset z knihovny. Odebrání z reference smaže pouze vazbu, nikdy samotný soubor.</p></div>
    {items.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((item, index) => {
      const asset = item.mediaAsset;
      const preview = asset.thumbnailPublicUrl ?? asset.publicUrl;
      return <article key={item.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/10"><div className="relative aspect-[4/3] bg-black/20">{preview ? <Image src={preview} alt={item.altText ?? asset.altText ?? asset.title ?? asset.fileName} fill className="object-cover" sizes="260px"/> : null}</div><div className="space-y-3 p-3"><div className="flex items-center justify-between gap-2"><span className="truncate text-sm text-white">{asset.title ?? asset.fileName}</span><span className="text-xs text-white/55">#{index + 1}</span></div><form action={updateReferenceMediaAction} className="grid gap-2"><input type="hidden" name="area" value={area}/><input type="hidden" name="id" value={item.id}/><label className="text-xs text-white/55">Alt text pro referenci<input name="altText" defaultValue={item.altText ?? ''} maxLength={160} className="mt-1 w-full rounded border border-white/10 bg-black/20 px-2 py-1.5 text-sm text-white"/></label><label className="text-xs text-white/55">Popisek<textarea name="caption" defaultValue={item.caption ?? ''} maxLength={300} rows={2} className="mt-1 w-full rounded border border-white/10 bg-black/20 px-2 py-1.5 text-sm text-white"/></label><label className="flex items-center gap-2 text-xs text-white/70"><input type="hidden" name="isVisible" value="false"/><input type="checkbox" name="isVisible" value="true" defaultChecked={item.isVisible}/> Zobrazit při budoucím zveřejnění</label><PendingSubmitButton pendingLabel="Ukládám…" className="min-h-11 w-fit text-xs text-[var(--color-accent-soft)]">Uložit metadata</PendingSubmitButton></form><div className="flex flex-wrap items-center gap-3 text-xs"><form action={moveReferenceMediaAction}><input type="hidden" name="area" value={area}/><input type="hidden" name="id" value={item.id}/><PendingSubmitButton name="direction" value="up" disabled={index === 0} pendingLabel="Přesouvám…" className="min-h-11 disabled:opacity-30">↑ Nahoru</PendingSubmitButton></form><form action={moveReferenceMediaAction}><input type="hidden" name="area" value={area}/><input type="hidden" name="id" value={item.id}/><PendingSubmitButton name="direction" value="down" disabled={index === items.length - 1} pendingLabel="Přesouvám…" className="min-h-11 disabled:opacity-30">↓ Dolů</PendingSubmitButton></form><form action={removeReferenceMediaAction}><input type="hidden" name="area" value={area}/><input type="hidden" name="id" value={item.id}/><PendingSubmitButton pendingLabel="Odebírám…" className="min-h-11 text-white/60">Odebrat membership</PendingSubmitButton></form></div></div></article>;
    })}</div> : <p className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-sm text-white/55">Kolekce REFERENCES je zatím prázdná.</p>}
    <div className="border-t border-white/10 pt-4"><h3 className="font-medium text-white">Přidat z Media Library</h3><p className="mt-1 text-xs text-white/55">Pro nový soubor použijte běžné nahrání níže; po nahrání jej zde vyberete.</p><div className="mt-3"><MediaPicker assets={assets} value={selectedId} onSelect={setSelectedId}/><form action={addReferenceMediaAction} className="mt-3"><input type="hidden" name="area" value={area}/><input type="hidden" name="mediaAssetId" value={selectedId}/><PendingSubmitButton disabled={!selectedId} pendingLabel="Přidávám…" className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40">Přidat do referencí</PendingSubmitButton></form></div></div>
  </section>;
}
