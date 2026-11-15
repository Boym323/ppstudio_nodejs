"use client";

import Image from "next/image";
import { useState } from "react";

import * as Dialog from "@/components/ui/dialog";
import {
  addServiceGalleryMediaAction,
  moveServiceGalleryMediaAction,
  removeServiceGalleryMediaAction,
  removeServiceHeroMediaAction,
  setServiceHeroMediaAction,
  updateServiceMediaAltTextAction,
  uploadServiceMediaAction,
} from "@/features/admin/actions/service-media-actions";
import { MediaPicker, type MediaPickerAsset } from "@/features/admin/components/media-picker";
import { MediaUploadDialog } from "@/features/admin/components/media-upload-dialog";
import { PendingSubmitButton } from "@/features/admin/components/pending-submit-button";
import { type AdminArea } from "@/config/navigation";
import { mediaUploadPolicy } from "@/lib/media/media-upload-policy";

/* Neveřejná média musí načíst prohlížeč s admin cookie; next/image ji nepředává interním fetchem. */
/* eslint-disable @next/next/no-img-element */

type ServiceMediaItem = {
  id: string;
  mediaAssetId: string;
  altText: string | null;
  sortOrder: number;
  mediaAsset: MediaPickerAsset & { adminPreviewUrl?: string | null };
};

export function ServiceMediaSection({ area, serviceId, hero, gallery }: { area: AdminArea; serviceId: string; hero: ServiceMediaItem | null; gallery: ServiceMediaItem[] }) {
  const accept = [...mediaUploadPolicy.allowedMimeTypes.keys()].join(",");
  const supportedTypes = [...mediaUploadPolicy.allowedMimeTypes.values()].flat().map((extension) => extension.toUpperCase()).join(", ");
  const [heroId, setHeroId] = useState(hero?.mediaAssetId ?? "");
  const [galleryId, setGalleryId] = useState("");
  const [selectedHero, setSelectedHero] = useState<MediaPickerAsset | null>(hero?.mediaAsset ?? null);
  const [selectedGallery, setSelectedGallery] = useState<MediaPickerAsset | null>(null);
  const [heroPickerOpen, setHeroPickerOpen] = useState(false);
  const [galleryPickerOpen, setGalleryPickerOpen] = useState(false);

  return <section className="space-y-5 rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
    <div><h2 className="text-lg font-semibold text-white">Fotografie služby</h2><p className="mt-1 text-sm text-white/60">Používají se jen publikovaná veřejná média. Odebrání zruší pouze vazbu, soubor v knihovně zůstává.</p></div>
    <div className="space-y-3 border-t border-white/10 pt-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-medium text-white">Hlavní fotografie</h3><p className="text-xs text-white/55">Zobrazuje se jako úvodní fotografie veřejné služby.</p></div><div className="flex flex-wrap justify-end gap-2"><MediaUploadDialog area={area} action={uploadServiceMediaAction} multiple={false} serviceId={serviceId} serviceRole="HERO" accept={accept} supportedTypes={supportedTypes} maxFileSizeMb={mediaUploadPolicy.maxFileSizeBytes / (1024 * 1024)} />{hero ? <form action={removeServiceHeroMediaAction}><input type="hidden" name="area" value={area}/><input type="hidden" name="serviceId" value={serviceId}/><PendingSubmitButton pendingLabel="Odebírám…" className="min-h-11 text-sm text-white/65 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">Odebrat vazbu</PendingSubmitButton></form> : null}</div></div>
      {hero ? <><div className="relative aspect-[16/8] overflow-hidden rounded-xl bg-black/20">{hero.mediaAsset.adminPreviewUrl ? <img src={hero.mediaAsset.adminPreviewUrl} alt={hero.altText ?? hero.mediaAsset.altText ?? hero.mediaAsset.title ?? hero.mediaAsset.fileName} className="h-full w-full object-cover"/> : <Image src={hero.mediaAsset.thumbnailPublicUrl ?? hero.mediaAsset.publicUrl!} alt={hero.altText ?? hero.mediaAsset.altText ?? hero.mediaAsset.title ?? hero.mediaAsset.fileName} fill className="object-cover" sizes="(min-width: 1024px) 520px, 100vw"/>}</div><form key={hero.mediaAssetId} action={updateServiceMediaAltTextAction} className="flex flex-col gap-2 sm:flex-row sm:items-end"><input type="hidden" name="area" value={area}/><input type="hidden" name="serviceId" value={serviceId}/><input type="hidden" name="id" value={hero.id}/><label className="min-w-0 flex-1 text-xs text-white/55">Alt text pro hlavní fotografii<input name="altText" defaultValue={hero.altText ?? ''} maxLength={160} className="mt-1 w-full rounded border border-white/10 bg-black/20 px-2 py-1.5 text-sm text-white"/></label><PendingSubmitButton pendingLabel="Ukládám…" className="min-h-11 text-xs text-[var(--color-accent-soft)]">Uložit alt text</PendingSubmitButton></form></> : <p className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-sm text-white/55">Hlavní fotografie zatím není vybraná.</p>}
      <Dialog.Root open={heroPickerOpen} onOpenChange={(open) => {
        if (open) {
          setHeroId(hero?.mediaAssetId ?? "");
          setSelectedHero(hero?.mediaAsset ?? null);
        }
        setHeroPickerOpen(open);
      }}><Dialog.Trigger asChild><button type="button" className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm text-white">{hero ? "Změnit fotografii" : "Vybrat fotografii"}</button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay/><Dialog.Content className="max-w-5xl rounded-[1.7rem] border border-white/10 bg-[#131116] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.45)] sm:p-6"><div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4"><div><Dialog.Title>Vybrat hlavní fotografii</Dialog.Title><Dialog.Description>Vyberte publikované médium z knihovny. Změní se pouze vazba služby.</Dialog.Description></div><Dialog.Close asChild><button type="button" className="min-h-11 min-w-11 rounded-full border border-white/10 px-3 py-2 text-sm text-white/72">Zavřít</button></Dialog.Close></div><div className="mt-5"><MediaPicker area={area} enabled={heroPickerOpen} scope={{ type: 'GENERAL', section: 'SERVICES' }} value={heroId} selectedAsset={selectedHero} onSelect={(asset) => { setHeroId(asset.id); setSelectedHero(asset); }}/></div><form action={setServiceHeroMediaAction} className="mt-5 flex justify-end"><input type="hidden" name="area" value={area}/><input type="hidden" name="serviceId" value={serviceId}/><input type="hidden" name="mediaAssetId" value={heroId}/><PendingSubmitButton disabled={!heroId} pendingLabel="Ukládám…" className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40">{hero ? "Změnit fotografii" : "Vybrat fotografii"}</PendingSubmitButton></form></Dialog.Content></Dialog.Portal></Dialog.Root>
    </div>
    <div className="space-y-3 border-t border-white/10 pt-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-medium text-white">Galerie</h3><p className="text-xs text-white/55">Pořadí upravíte šipkami; stejnou fotografii nelze přidat dvakrát.</p></div><MediaUploadDialog area={area} action={uploadServiceMediaAction} multiple={false} serviceId={serviceId} serviceRole="GALLERY" accept={accept} supportedTypes={supportedTypes} maxFileSizeMb={mediaUploadPolicy.maxFileSizeBytes / (1024 * 1024)} /></div>
      {gallery.length ? <div className="grid gap-3 sm:grid-cols-2">{gallery.map((item, index) => { const asset = item.mediaAsset; const preview = asset.thumbnailPublicUrl ?? asset.publicUrl; return <div key={item.id} className="overflow-hidden rounded-xl border border-white/10"><div className="relative aspect-[4/3] bg-black/20">{asset.adminPreviewUrl ? <img src={asset.adminPreviewUrl} alt={item.altText ?? asset.altText ?? asset.title ?? asset.fileName} className="h-full w-full object-cover"/> : preview ? <Image src={preview} alt={item.altText ?? asset.altText ?? asset.title ?? asset.fileName} fill className="object-cover" sizes="260px"/> : null}</div><div className="space-y-2 p-2"><span className="block truncate text-xs text-white/75">{asset.title ?? asset.fileName}</span><form action={updateServiceMediaAltTextAction} className="flex flex-col gap-2"><input type="hidden" name="area" value={area}/><input type="hidden" name="serviceId" value={serviceId}/><input type="hidden" name="id" value={item.id}/><label className="text-xs text-white/55">Alt text pro fotografii<input name="altText" defaultValue={item.altText ?? ''} maxLength={160} className="mt-1 w-full rounded border border-white/10 bg-black/20 px-2 py-1.5 text-sm text-white"/></label><PendingSubmitButton pendingLabel="Ukládám…" className="min-h-11 w-fit text-xs text-[var(--color-accent-soft)]">Uložit alt text</PendingSubmitButton></form><div className="flex flex-wrap gap-2"><form action={moveServiceGalleryMediaAction}><input type="hidden" name="area" value={area}/><input type="hidden" name="serviceId" value={serviceId}/><input type="hidden" name="id" value={item.id}/><input type="hidden" name="direction" value="up"/><PendingSubmitButton aria-label="Posunout nahoru" disabled={index === 0} pendingLabel="…" className="min-h-11 min-w-11 text-xs disabled:opacity-30">↑</PendingSubmitButton></form><form action={moveServiceGalleryMediaAction}><input type="hidden" name="area" value={area}/><input type="hidden" name="serviceId" value={serviceId}/><input type="hidden" name="id" value={item.id}/><input type="hidden" name="direction" value="down"/><PendingSubmitButton aria-label="Posunout dolů" disabled={index === gallery.length - 1} pendingLabel="…" className="min-h-11 min-w-11 text-xs disabled:opacity-30">↓</PendingSubmitButton></form><form action={removeServiceGalleryMediaAction}><input type="hidden" name="area" value={area}/><input type="hidden" name="serviceId" value={serviceId}/><input type="hidden" name="id" value={item.id}/><PendingSubmitButton pendingLabel="…" className="min-h-11 text-xs text-white/60">Odebrat vazbu</PendingSubmitButton></form></div></div></div>; })}</div> : <p className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-sm text-white/55">Galerie je zatím prázdná.</p>}
      <Dialog.Root open={galleryPickerOpen} onOpenChange={setGalleryPickerOpen}><Dialog.Trigger asChild><button type="button" className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm text-white">Přidat fotografii</button></Dialog.Trigger><Dialog.Portal><Dialog.Overlay/><Dialog.Content className="max-w-5xl rounded-[1.7rem] border border-white/10 bg-[#131116] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.45)] sm:p-6"><div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4"><div><Dialog.Title>Přidat fotografii do galerie</Dialog.Title><Dialog.Description>Vyberte publikované médium z knihovny. Stejnou fotografii nelze přidat dvakrát.</Dialog.Description></div><Dialog.Close asChild><button type="button" className="min-h-11 min-w-11 rounded-full border border-white/10 px-3 py-2 text-sm text-white/72">Zavřít</button></Dialog.Close></div><div className="mt-5"><MediaPicker area={area} enabled={galleryPickerOpen} scope={{ type: 'SERVICE_GALLERY', serviceId }} value={galleryId} selectedAsset={selectedGallery} onSelect={(asset) => { setGalleryId(asset.id); setSelectedGallery(asset); }}/></div><form action={addServiceGalleryMediaAction} className="mt-5 flex justify-end"><input type="hidden" name="area" value={area}/><input type="hidden" name="serviceId" value={serviceId}/><input type="hidden" name="mediaAssetId" value={galleryId}/><PendingSubmitButton disabled={!galleryId} pendingLabel="Přidávám…" className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40">Přidat do galerie</PendingSubmitButton></form></Dialog.Content></Dialog.Portal></Dialog.Root>
    </div>
  </section>;
}
