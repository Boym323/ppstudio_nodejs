'use client';

import Image from 'next/image';
import { useState } from 'react';

import * as Dialog from '@/components/ui/dialog';
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

export function ReferenceMediaSection({ area, items }: { area: AdminArea; items: ReferenceMediaItem[] }) {
  const [selectedId, setSelectedId] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<MediaPickerAsset | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  return <section className="mb-5 space-y-4 rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
    <div><h2 className="text-lg font-semibold text-white">Reference</h2><p className="mt-1 text-sm text-white/60">Vyberte existující médium z knihovny. Odebrání z reference zruší pouze jeho zařazení, nikdy nesmaže samotný soubor.</p></div>
    {items.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((item, index) => {
      const asset = item.mediaAsset;
      const preview = asset.thumbnailPublicUrl ?? asset.publicUrl;
      return <article key={item.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/10"><div className="relative aspect-[4/3] bg-black/20">{preview ? <Image src={preview} alt={item.altText ?? asset.altText ?? asset.title ?? asset.fileName} fill className="object-cover" sizes="260px"/> : null}</div><div className="space-y-3 p-3"><div className="flex items-center justify-between gap-2"><span className="truncate text-sm text-white">{asset.title ?? asset.fileName}</span><span className="text-xs text-white/55">#{index + 1}</span></div><form action={updateReferenceMediaAction} className="grid gap-2"><input type="hidden" name="area" value={area}/><input type="hidden" name="id" value={item.id}/><label className="text-xs text-white/55">Alt text pro referenci<input name="altText" defaultValue={item.altText ?? ''} maxLength={160} className="mt-1 w-full rounded border border-white/10 bg-black/20 px-2 py-1.5 text-sm text-white"/></label><label className="text-xs text-white/55">Popisek<textarea name="caption" defaultValue={item.caption ?? ''} maxLength={300} rows={2} className="mt-1 w-full rounded border border-white/10 bg-black/20 px-2 py-1.5 text-sm text-white"/></label><label className="flex items-center gap-2 text-xs text-white/70"><input type="hidden" name="isVisible" value="false"/><input type="checkbox" name="isVisible" value="true" defaultChecked={item.isVisible}/> Zobrazit při budoucím zveřejnění</label><PendingSubmitButton pendingLabel="Ukládám…" className="min-h-11 w-fit text-xs text-[var(--color-accent-soft)]">Uložit metadata</PendingSubmitButton></form><div className="flex flex-wrap items-center gap-3 text-xs"><form action={moveReferenceMediaAction}><input type="hidden" name="area" value={area}/><input type="hidden" name="id" value={item.id}/><PendingSubmitButton name="direction" value="up" disabled={index === 0} pendingLabel="Přesouvám…" className="min-h-11 disabled:opacity-30">↑ Nahoru</PendingSubmitButton></form><form action={moveReferenceMediaAction}><input type="hidden" name="area" value={area}/><input type="hidden" name="id" value={item.id}/><PendingSubmitButton name="direction" value="down" disabled={index === items.length - 1} pendingLabel="Přesouvám…" className="min-h-11 disabled:opacity-30">↓ Dolů</PendingSubmitButton></form><form action={removeReferenceMediaAction}><input type="hidden" name="area" value={area}/><input type="hidden" name="id" value={item.id}/><PendingSubmitButton pendingLabel="Odebírám…" className="min-h-11 text-white/60">Odebrat zařazení</PendingSubmitButton></form></div></div></article>;
    })}</div> : <p className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-sm text-white/55">Tato kolekce je zatím prázdná.</p>}
    <div className="border-t border-white/10 pt-4"><h3 className="font-medium text-white">Přidat z knihovny médií</h3><p className="mt-1 text-xs text-white/55">Pro nový soubor použijte běžné nahrání níže; po nahrání jej zde vyberete.</p><Dialog.Root open={pickerOpen} onOpenChange={setPickerOpen}><Dialog.Trigger asChild><button type="button" className="mt-3 min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm text-white">Přidat referenci</button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay/><Dialog.Content className="max-w-5xl rounded-[1.7rem] border border-white/10 bg-[#131116] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.45)] sm:p-6"><div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4"><div><Dialog.Title>Přidat referenci</Dialog.Title><Dialog.Description>Vyberte publikované médium z knihovny. Přidá se pouze jeho zařazení.</Dialog.Description></div><Dialog.Close asChild><button type="button" className="min-h-11 min-w-11 rounded-full border border-white/10 px-3 py-2 text-sm text-white/72">Zavřít</button></Dialog.Close></div><div className="mt-5"><MediaPicker area={area} enabled={pickerOpen} scope={{ type: 'REFERENCES' }} value={selectedId} selectedAsset={selectedAsset} onSelect={(asset) => { setSelectedId(asset.id); setSelectedAsset(asset); }}/></div><form action={addReferenceMediaAction} className="mt-5 flex justify-end"><input type="hidden" name="area" value={area}/><input type="hidden" name="mediaAssetId" value={selectedId}/><PendingSubmitButton disabled={!selectedId} pendingLabel="Přidávám…" className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40">Přidat do referencí</PendingSubmitButton></form></Dialog.Content></Dialog.Portal></Dialog.Root></div>
  </section>;
}
