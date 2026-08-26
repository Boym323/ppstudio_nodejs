'use client';

import Image from 'next/image';
import { useState } from 'react';

import * as Dialog from '@/components/ui/dialog';
import { updateMediaCollectionMembershipAction } from '@/features/admin/actions/media-actions';
import { MediaPicker, type MediaPickerAsset } from '@/features/admin/components/media-picker';
import { PendingSubmitButton } from '@/features/admin/components/pending-submit-button';
import { type AdminArea } from '@/config/navigation';

export type MediaCollectionSectionItem = {
  id: string;
  mediaAssetId: string;
  sortOrder: number;
  isVisible: boolean;
  mediaAsset: MediaPickerAsset;
};

type ManagedCollectionType = 'STUDIO_GALLERY' | 'CERTIFICATES';

const collectionCopy: Record<ManagedCollectionType, { label: string; objectFit: 'object-cover' | 'object-contain' }> = {
  STUDIO_GALLERY: { label: 'Studio', objectFit: 'object-cover' },
  CERTIFICATES: { label: 'Certifikáty', objectFit: 'object-contain' },
};

export function MediaCollectionSection({ area, collectionType, items, assets, returnTo }: { area: AdminArea; collectionType: ManagedCollectionType; items: MediaCollectionSectionItem[]; assets: MediaPickerAsset[]; returnTo: string }) {
  const [selectedId, setSelectedId] = useState('');
  const { label, objectFit } = collectionCopy[collectionType];
  const membershipFields = (assetId: string) => <><input type="hidden" name="area" value={area}/><input type="hidden" name="assetId" value={assetId}/><input type="hidden" name="collectionType" value={collectionType}/><input type="hidden" name="returnTo" value={returnTo}/></>;

  return <section className="mb-5 space-y-4 rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
    <div><h2 className="text-lg font-semibold text-white">{label}</h2><p className="mt-1 text-sm text-white/60">Zobrazuje se celá kolekce bez hledání a filtrů knihovny. Odebrání z kolekce zruší pouze zařazení a nikdy nesmaže samotný soubor z Media Library.</p></div>
    {items.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((item, index) => {
      const asset = item.mediaAsset;
      const preview = asset.thumbnailPublicUrl ?? asset.publicUrl;
      return <article key={item.id} className="overflow-hidden rounded-xl border border-white/10 bg-black/10"><div className="relative aspect-[4/3] bg-black/20">{preview ? <Image src={preview} alt={asset.altText ?? asset.title ?? asset.fileName} fill className={objectFit} sizes="260px"/> : null}</div><div className="space-y-3 p-3"><div className="flex items-center justify-between gap-2"><span className="truncate text-sm text-white">{asset.title ?? asset.fileName}</span><span className="text-xs text-white/55">#{index + 1}</span></div><div className="flex flex-wrap gap-2 text-xs"><span className={`rounded-full border px-2 py-1 ${asset.publicUrl ? 'border-emerald-200/20 text-emerald-100' : 'border-white/12 text-white/55'}`}>{asset.publicUrl ? 'Publikováno' : 'Skryto'}</span><span className={`rounded-full border px-2 py-1 ${item.isVisible ? 'border-emerald-200/20 text-emerald-100' : 'border-white/12 text-white/55'}`}>{item.isVisible ? 'Viditelné v kolekci' : 'Skryté v kolekci'}</span></div><div className="flex flex-wrap items-center gap-3 text-xs"><form action={updateMediaCollectionMembershipAction}>{membershipFields(item.mediaAssetId)}<input type="hidden" name="action" value="move"/><PendingSubmitButton name="direction" value="up" disabled={index === 0} pendingLabel="Přesouvám…" className="min-h-11 disabled:opacity-30">↑ Nahoru</PendingSubmitButton></form><form action={updateMediaCollectionMembershipAction}>{membershipFields(item.mediaAssetId)}<input type="hidden" name="action" value="move"/><PendingSubmitButton name="direction" value="down" disabled={index === items.length - 1} pendingLabel="Přesouvám…" className="min-h-11 disabled:opacity-30">↓ Dolů</PendingSubmitButton></form><form action={updateMediaCollectionMembershipAction}>{membershipFields(item.mediaAssetId)}<input type="hidden" name="action" value="save"/><input type="hidden" name="isVisible" value={item.isVisible ? 'false' : 'true'}/><PendingSubmitButton pendingLabel="Ukládám…" className="min-h-11 text-white/70">{item.isVisible ? 'Skrýt v kolekci' : 'Zobrazit v kolekci'}</PendingSubmitButton></form><form action={updateMediaCollectionMembershipAction}>{membershipFields(item.mediaAssetId)}<PendingSubmitButton name="action" value="remove" pendingLabel="Odebírám…" className="min-h-11 text-white/60">Odebrat z kolekce</PendingSubmitButton></form></div></div></article>;
    })}</div> : <p className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-sm text-white/55">V této kolekci zatím nejsou žádná média.</p>}
    <div className="border-t border-white/10 pt-4"><Dialog.Root><Dialog.Trigger asChild><button type="button" className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm text-white">Přidat z knihovny</button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay/><Dialog.Content className="max-w-5xl rounded-[1.7rem] border border-white/10 bg-[#131116] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.45)] sm:p-6"><div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4"><div><Dialog.Title>Přidat do kolekce {label}</Dialog.Title><Dialog.Description>Vyberte médium z knihovny. Přidá se na konec kolekce.</Dialog.Description></div><Dialog.Close asChild><button type="button" className="min-h-11 min-w-11 rounded-full border border-white/10 px-3 py-2 text-sm text-white/72">Zavřít</button></Dialog.Close></div><div className="mt-5"><MediaPicker assets={assets} value={selectedId} onSelect={setSelectedId}/></div><form action={updateMediaCollectionMembershipAction} className="mt-5 flex justify-end">{membershipFields(selectedId)}<input type="hidden" name="action" value="add"/><input type="hidden" name="isVisible" value="true"/><PendingSubmitButton disabled={!selectedId} pendingLabel="Přidávám…" className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40">Přidat do kolekce</PendingSubmitButton></form></Dialog.Content></Dialog.Portal></Dialog.Root></div>
  </section>;
}
