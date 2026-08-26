"use client";

import Image from "next/image";
import { useState } from "react";

import {
  addServiceGalleryMediaAction,
  moveServiceGalleryMediaAction,
  removeServiceGalleryMediaAction,
  removeServiceHeroMediaAction,
  setServiceHeroMediaAction,
} from "@/features/admin/actions/service-media-actions";
import { MediaPicker, type MediaPickerAsset } from "@/features/admin/components/media-picker";
import { PendingSubmitButton } from "@/features/admin/components/pending-submit-button";
import { type AdminArea } from "@/config/navigation";

type ServiceMediaItem = {
  id: string;
  mediaAssetId: string;
  altText: string | null;
  sortOrder: number;
  mediaAsset: MediaPickerAsset;
};

export function ServiceMediaSection({ area, serviceId, assets, hero, gallery }: { area: AdminArea; serviceId: string; assets: MediaPickerAsset[]; hero: ServiceMediaItem | null; gallery: ServiceMediaItem[] }) {
  const [heroId, setHeroId] = useState(hero?.mediaAssetId ?? "");
  const [galleryId, setGalleryId] = useState("");
  const selectedHero = assets.find((asset) => asset.id === heroId);

  return <section className="space-y-5 rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
    <div><h2 className="text-lg font-semibold text-white">Fotografie služby</h2><p className="mt-1 text-sm text-white/60">Používají se jen publikovaná veřejná média. Odebrání zruší pouze vazbu, soubor v knihovně zůstává.</p></div>
    <div className="space-y-3 border-t border-white/10 pt-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-medium text-white">Hlavní fotografie</h3><p className="text-xs text-white/55">Zobrazuje se jako úvodní fotografie veřejné služby.</p></div>{hero ? <form action={removeServiceHeroMediaAction}><input type="hidden" name="area" value={area}/><input type="hidden" name="serviceId" value={serviceId}/><PendingSubmitButton pendingLabel="Odebírám…" className="min-h-11 text-sm text-white/65 hover:text-white">Odebrat vazbu</PendingSubmitButton></form> : null}</div>
      {hero && selectedHero ? <div className="relative aspect-[16/8] overflow-hidden rounded-xl bg-black/20"><Image src={selectedHero.thumbnailPublicUrl ?? selectedHero.publicUrl!} alt={hero.altText ?? selectedHero.altText ?? selectedHero.title ?? selectedHero.fileName} fill className="object-cover" sizes="(min-width: 1024px) 520px, 100vw"/></div> : <p className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-sm text-white/55">Hlavní fotografie zatím není vybraná.</p>}
      <MediaPicker assets={assets} value={heroId} onSelect={setHeroId}/>
      <form action={setServiceHeroMediaAction}><input type="hidden" name="area" value={area}/><input type="hidden" name="serviceId" value={serviceId}/><input type="hidden" name="mediaAssetId" value={heroId}/><PendingSubmitButton disabled={!heroId} pendingLabel="Ukládám…" className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40">{hero ? "Změnit" : "Vybrat fotografii"}</PendingSubmitButton></form>
    </div>
    <div className="space-y-3 border-t border-white/10 pt-4"><div><h3 className="font-medium text-white">Galerie</h3><p className="text-xs text-white/55">Pořadí upravíte šipkami; stejnou fotografii nelze přidat dvakrát.</p></div>
      {gallery.length ? <div className="grid gap-3 sm:grid-cols-2">{gallery.map((item, index) => { const asset = item.mediaAsset; const preview = asset.thumbnailPublicUrl ?? asset.publicUrl; return <div key={item.id} className="overflow-hidden rounded-xl border border-white/10"><div className="relative aspect-[4/3] bg-black/20">{preview ? <Image src={preview} alt={item.altText ?? asset.altText ?? asset.title ?? asset.fileName} fill className="object-cover" sizes="260px"/> : null}</div><div className="flex items-center justify-between gap-2 p-2"><span className="truncate text-xs text-white/75">{asset.title ?? asset.fileName}</span><div className="flex gap-2"><form action={moveServiceGalleryMediaAction}><input type="hidden" name="area" value={area}/><input type="hidden" name="serviceId" value={serviceId}/><input type="hidden" name="id" value={item.id}/><input type="hidden" name="direction" value="up"/><PendingSubmitButton aria-label="Posunout nahoru" disabled={index === 0} pendingLabel="…" className="min-h-11 min-w-11 text-xs disabled:opacity-30">↑</PendingSubmitButton></form><form action={moveServiceGalleryMediaAction}><input type="hidden" name="area" value={area}/><input type="hidden" name="serviceId" value={serviceId}/><input type="hidden" name="id" value={item.id}/><input type="hidden" name="direction" value="down"/><PendingSubmitButton aria-label="Posunout dolů" disabled={index === gallery.length - 1} pendingLabel="…" className="min-h-11 min-w-11 text-xs disabled:opacity-30">↓</PendingSubmitButton></form><form action={removeServiceGalleryMediaAction}><input type="hidden" name="area" value={area}/><input type="hidden" name="serviceId" value={serviceId}/><input type="hidden" name="id" value={item.id}/><PendingSubmitButton pendingLabel="…" className="min-h-11 text-xs text-white/60">Odebrat vazbu</PendingSubmitButton></form></div></div></div>; })}</div> : <p className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-sm text-white/55">Galerie je zatím prázdná.</p>}
      <MediaPicker assets={assets} value={galleryId} onSelect={setGalleryId}/><form action={addServiceGalleryMediaAction}><input type="hidden" name="area" value={area}/><input type="hidden" name="serviceId" value={serviceId}/><input type="hidden" name="mediaAssetId" value={galleryId}/><PendingSubmitButton disabled={!galleryId} pendingLabel="Přidávám…" className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40">Přidat do galerie</PendingSubmitButton></form>
    </div>
  </section>;
}
