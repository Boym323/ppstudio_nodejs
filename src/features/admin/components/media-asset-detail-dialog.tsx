'use client';

import Image from 'next/image';
import Link from 'next/link';
import { hasCroppedMediaPlacement, mediaUsageHref, mediaUsageLabel as usageLabel, type MediaUsageReference } from '@/features/admin/lib/admin-media-presentation';
import { type FormEvent, useRef, useState } from 'react';

import * as AlertDialog from '@/components/ui/alert-dialog';
import * as Dialog from '@/components/ui/dialog';
import { deleteMediaAction, replaceMediaAction, updateMediaMetadataAction, updateMediaPublicationAction, updateMediaCollectionMembershipAction } from '@/features/admin/actions/media-actions';
import { PendingSubmitButton } from '@/features/admin/components/pending-submit-button';
import { mediaUploadPolicy } from '@/lib/media/media-upload-policy';

/* Admin preview musí načítat prohlížeč s přihlašovacím cookie; next/image ho při interním fetchi nepředává. */
/* eslint-disable @next/next/no-img-element */

type AdminArea = 'owner' | 'salon';
type Asset = {
  id: string;
  title: string | null;
  altText: string | null;
  focalPointX: number;
  focalPointY: number;
  fileName: string;
  originalFilename: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  size: number;
  isPublished: boolean;
  thumbnailPublicUrl: string | null;
  publicUrl: string | null;
  adminPreviewUrl: string | null;
};
type Usage = { isUsed: boolean; references: MediaUsageReference[] };
type Membership = { type: 'STUDIO_GALLERY' | 'CERTIFICATES' | 'REFERENCES'; sortOrder: number; isVisible: boolean; canMoveUp: boolean; canMoveDown: boolean };

const collections = [
  { type: 'STUDIO_GALLERY', label: 'Studio' },
  { type: 'CERTIFICATES', label: 'Certifikáty' },
  { type: 'REFERENCES', label: 'Reference' },
] as const;
const bytes = (value: number) => value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;
const cropPreviews = [
  { value: '16:9', label: '16:9 · karty služeb', className: 'aspect-[16/9] max-w-[32rem]' },
  { value: '4:3', label: '4:3 · galerie služeb, kontakt', className: 'aspect-[4/3] max-w-[24rem]' },
  { value: '5:4', label: '5:4 · kontakt na tabletu', className: 'aspect-[5/4] max-w-[22rem]' },
  { value: '7:6', label: '7:6 · galerie studia na počítači', className: 'aspect-[7/6] max-w-[21rem]' },
  { value: '1:1', label: '1:1 · hlavní foto studia, portrét O mně (přibližně)', className: 'aspect-square max-w-[18rem]' },
  { value: '3:2', label: '3:2 · portrét na homepage (přibližně)', className: 'aspect-[3/2] max-w-[27rem]' },
] as const;
type CropPreview = typeof cropPreviews[number]['value'];

function initialCropPreview(usage: Usage, memberships: Membership[]): CropPreview {
  if (usage.references.some(({ source, field }) => source === 'ServiceMedia' && field.startsWith('HERO:'))) return '16:9';
  if (usage.references.some(({ source, field }) => source === 'ServiceMedia' && field.startsWith('GALLERY:'))) return '4:3';
  if (usage.references.some(({ field }) => field === 'contactPhotoMediaId')) return '4:3';
  if (usage.references.some(({ field }) => field === 'STUDIO_GALLERY')) {
    return memberships.some(({ type, isVisible, canMoveUp }) => type === 'STUDIO_GALLERY' && isVisible && !canMoveUp) ? '1:1' : '7:6';
  }
  if (usage.references.some(({ field }) => field === 'homePortraitMediaId')) return '3:2';
  if (usage.references.some(({ field }) => field === 'aboutPortraitMediaId')) return '1:1';
  return '16:9';
}

export function requiresUnpublishConfirmation(isPublished: boolean, isUsed: boolean) {
  return isPublished && isUsed;
}

export function MediaAssetDetailDialog({ area, asset, usage, memberships, returnTo, layout = 'grid' }: { area: AdminArea; asset: Asset; usage: Usage; memberships: Membership[]; returnTo: string; layout?: 'list' | 'grid' }) {
  const preview = asset.thumbnailPublicUrl ?? asset.publicUrl ?? asset.adminPreviewUrl;
  const isAdminPreview = Boolean(asset.adminPreviewUrl);
  const isDocumentStyle = memberships.some((membership) => membership.type === 'CERTIFICATES');
  const hasCroppedPlacement = hasCroppedMediaPlacement(usage.references, memberships);
  const fileName = asset.originalFilename ?? asset.fileName;
  const [focalPoint, setFocalPoint] = useState({ x: asset.focalPointX, y: asset.focalPointY });
  const [selectedCrop, setSelectedCrop] = useState<CropPreview>(() => initialCropPreview(usage, memberships));
  const cropPreview = cropPreviews.find(({ value }) => value === selectedCrop)!;

  return (
    <Dialog.Root>
      <article className="h-full overflow-hidden rounded-xl border border-white/10 bg-white/[0.035]">
        <Dialog.Trigger asChild>
          <button type="button" className={`group w-full text-left hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] ${layout === 'list' ? 'flex items-center gap-3 p-3' : 'block'}`} aria-label={`Otevřít detail média ${asset.title || fileName}`}>
            <div className={`relative overflow-hidden bg-black/25 ${layout === 'list' ? 'h-16 w-20 shrink-0 rounded-lg' : 'aspect-[4/3]'}`}>
              {isAdminPreview ? <img src={asset.adminPreviewUrl!} alt="" style={{ objectPosition: `${asset.focalPointX}% ${asset.focalPointY}%` }} className={`h-full w-full ${isDocumentStyle ? 'object-contain' : 'object-cover'}`}/> : preview ? <Image src={preview} alt="" fill sizes={layout === 'list' ? '80px' : '(min-width: 1024px) 25vw, 50vw'} style={{ objectPosition: `${asset.focalPointX}% ${asset.focalPointY}%` }} className={isDocumentStyle ? 'object-contain' : 'object-cover'}/> : <span className="text-xs text-white/45">Bez náhledu</span>}
            </div>
            <div className={`min-w-0 flex-1 space-y-1 ${layout === 'grid' ? 'p-3' : ''}`}>
              <p className="truncate font-semibold text-white">{asset.title || fileName}</p>
              <p className="truncate text-xs text-white/50">{asset.title ? fileName : 'Chybí vlastní název'} · {bytes(asset.size)}{asset.width && asset.height ? ` · ${asset.width} × ${asset.height}` : ''}</p>
              <div className="flex flex-wrap gap-2 text-xs"><span className={asset.isPublished ? 'text-emerald-200' : 'text-white/55'}>{asset.isPublished ? 'Publikováno' : 'Nepublikováno'}</span><span className="text-white/50">{usage.isUsed ? `${usage.references.length}× přiřazeno` : 'Bez použití'}</span></div>
            </div>
            {layout === 'list' ? <span className="shrink-0 text-xs text-[var(--color-accent-soft)]">Upravit</span> : null}
          </button>
        </Dialog.Trigger>
        <div className={`flex flex-wrap gap-x-3 gap-y-1 px-3 pb-3 text-xs ${layout === 'list' ? 'sm:pl-[6.5rem]' : ''}`}>
          {usage.references.length ? usage.references.map((reference) => {
            const href = mediaUsageHref(area, reference);
            return href ? <Link key={`${reference.source}-${reference.recordId}`} href={href} className="text-[var(--color-accent-soft)] underline underline-offset-4">{usageLabel(reference)}</Link> : <span key={`${reference.source}-${reference.recordId}`} className="text-white/60">{usageLabel(reference)}</span>;
          }) : <span className="text-white/40">Zatím není přiřazeno k žádnému umístění.</span>}
        </div>
      </article>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="max-w-5xl rounded-[1.7rem] border border-white/10 bg-[#131116] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.45)] sm:p-6">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent-soft)]">Detail média</p>
              <Dialog.Title className="truncate">{asset.title || fileName}</Dialog.Title>
              <Dialog.Description>Upravte název, popis a publikaci. Přiřazení níže ukazuje místa, která mohou tento soubor používat.</Dialog.Description>
            </div>
            <Dialog.Close asChild><button type="button" className="min-h-11 shrink-0 rounded-full border border-white/10 px-3 py-2 text-sm text-white/72 transition hover:border-white/18 hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">Zavřít</button></Dialog.Close>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,.95fr)]">
            <section className="order-2 space-y-4 lg:order-1" aria-label="Náhled a soubor">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.2rem] border border-white/10 bg-black/30">
                {isAdminPreview ? <img src={asset.adminPreviewUrl!} alt={asset.altText ?? asset.title ?? asset.fileName} className="h-full w-full object-contain"/> : preview ? <Image src={preview} alt={asset.altText ?? asset.title ?? asset.fileName} fill sizes="(min-width: 1024px) 52vw, 100vw" className="object-contain"/> : <div className="flex h-full items-center justify-center text-sm text-white/45">Skrytý náhled</div>}
              </div>
              {preview && hasCroppedPlacement ? (
                <details className="space-y-2.5">
                  <summary className="min-h-11 cursor-pointer py-3 text-sm text-white/75">Náhledy ořezu</summary>
                  <label className="block text-xs font-semibold uppercase tracking-[.14em] text-white/60" htmlFor={`crop-preview-${asset.id}`}>
                    Náhled ořezu podle umístění
                  </label>
                  <select
                    id={`crop-preview-${asset.id}`}
                    value={selectedCrop}
                    onChange={(event) => setSelectedCrop(event.target.value as CropPreview)}
                    className="min-h-10 w-full rounded-[.7rem] border border-white/15 bg-[#211e24] px-3 py-2 text-sm text-white"
                  >
                    {cropPreviews.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <div className={`relative mx-auto w-full overflow-hidden rounded-[1rem] border border-white/10 bg-black/30 ${cropPreview.className}`}>
                    {isAdminPreview
                      ? <img src={asset.adminPreviewUrl!} alt={`Náhled ořezu ${selectedCrop}`} style={{ objectPosition: `${focalPoint.x}% ${focalPoint.y}%` }} className="h-full w-full object-cover"/>
                      : <Image src={preview} alt={`Náhled ořezu ${selectedCrop}`} fill sizes="(min-width: 1024px) 52vw, 100vw" style={{ objectPosition: `${focalPoint.x}% ${focalPoint.y}%` }} className="object-cover"/>}
                  </div>
                  <p className="text-xs leading-5 text-white/55">Ohnisko se použije ve všech ořezávaných zobrazeních této fotografie. U portrétů a studia se poměr mění podle velikosti obrazovky; náhled je orientační.</p>
                  {isDocumentStyle ? <p className="text-xs leading-5 text-white/55">Certifikáty se zobrazují celé, bez ořezu.</p> : null}
                </details>
              ) : null}
              <div className="rounded-[1rem] border border-white/8 bg-black/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-white/48">Soubor</p>
                <p className="mt-2 break-all text-sm leading-6 text-white/78">{fileName}</p>
                <p className="mt-1 text-xs leading-5 text-white/48">{asset.mimeType} · {asset.width && asset.height ? `${asset.width} × ${asset.height}` : 'rozměry neznámé'} · {bytes(asset.size)}</p>
                <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${asset.isPublished ? 'border-emerald-200/15 bg-emerald-950/75 text-emerald-100' : 'border-white/15 bg-black/40 text-white/75'}`}>{asset.isPublished ? 'Publikováno' : 'Nepublikováno'}</span>
              </div>
              <section className="rounded-[1rem] border border-white/8 bg-black/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-white/48">Přiřazení k umístění</p><p className="mt-1 text-xs text-white/50">Přiřazení samo nezaručuje zobrazení: záleží také na publikaci souboru a viditelnosti umístění.</p>
                <ul className="mt-2 space-y-1.5 text-sm leading-6 text-white/72">
                  {usage.references.length ? usage.references.map((reference) => <li key={`${reference.source}-${reference.recordId}-${reference.field}`}>{mediaUsageHref(area, reference) ? <Link href={mediaUsageHref(area, reference)!} className="underline underline-offset-4">{usageLabel(reference)}</Link> : usageLabel(reference)}</li>) : <li className="text-white/58">Nikde — médium lze bezpečně smazat.</li>}
                </ul>
              </section>
            </section>

            <div className="order-1 space-y-4 lg:order-2">
              <section className="space-y-3 rounded-[1rem] border border-white/8 bg-black/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-white/48">Metadata</p>
                <form action={updateMediaMetadataAction} className="grid gap-3">
                  <input type="hidden" name="area" value={area}/><input type="hidden" name="assetId" value={asset.id}/><input type="hidden" name="returnTo" value={returnTo}/>
                  <label className="text-xs text-white/60">Titulek<input name="title" defaultValue={asset.title ?? ''} maxLength={120} className="mt-1 w-full rounded-[.7rem] border border-white/10 bg-black/20 px-2.5 py-2 text-sm text-white"/></label>
                  <label className="text-xs text-white/60">Výchozí alt text<input name="altText" defaultValue={asset.altText ?? ''} maxLength={160} className="mt-1 w-full rounded-[.7rem] border border-white/10 bg-black/20 px-2.5 py-2 text-sm text-white"/></label>
                  {hasCroppedPlacement ? <fieldset className="space-y-2 rounded-[.7rem] border border-white/8 bg-black/15 p-3">
                    <legend className="px-1 text-xs text-white/60">Ohnisko fotografie</legend>
                    <p className="text-[11px] leading-4 text-white/45">Určuje část snímku, která zůstane při ořezu viditelná na webu.</p>
                    <FocalPointControls point={focalPoint} onChange={setFocalPoint}/>
                  </fieldset> : <><input type="hidden" name="focalPointX" value={asset.focalPointX}/><input type="hidden" name="focalPointY" value={asset.focalPointY}/></>}
                  <PendingSubmitButton pendingLabel="Ukládám…" className="min-h-10 w-fit rounded-full border border-white/12 px-3.5 py-2 text-xs">Uložit metadata</PendingSubmitButton>
                </form>
                <PublishAction area={area} asset={asset} usage={usage} returnTo={returnTo}/>
              </section>

              <section className="space-y-3 rounded-[1rem] border border-white/8 bg-black/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-white/48">Použití a kolekce</p>
                <Memberships area={area} assetId={asset.id} memberships={memberships} returnTo={returnTo}/>
              </section>

              <details className="space-y-3 rounded-[1rem] border border-white/8 bg-black/10 p-4">
                <summary className="min-h-11 cursor-pointer py-3 text-sm text-white/70">Nahradit soubor</summary>
                <p className="text-xs leading-5 text-white/55">Náhrada zachová všechna použití tohoto média.</p>
                <ReplaceMediaAction area={area} assetId={asset.id} usage={usage} returnTo={returnTo}/>
              </details>

              <details className="border-t border-red-300/15 pt-4" aria-label="Destruktivní akce">
                <summary className="min-h-11 cursor-pointer py-3 text-sm text-red-100/70">Odstranit médium</summary>
                {usage.isUsed ? <p className="mt-3 rounded-[.9rem] border border-amber-200/15 bg-amber-300/10 px-3 py-2.5 text-xs leading-5 text-amber-50">Smazání je blokované: médium se používá na místech uvedených výše. Nejprve jejich použití odeberte; soubor zatím zůstává v knihovně.</p> : <DeleteAssetAction area={area} assetId={asset.id} fileName={fileName} returnTo={returnTo}/>}
              </details>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FocalPointControls({ point, onChange }: { point: { x: number; y: number }; onChange: (point: { x: number; y: number }) => void }) {
  return <>
    <label className="block text-xs text-white/60">Vodorovně: {point.x}%<input type="range" name="focalPointX" min="0" max="100" step="1" value={point.x} onChange={(event) => onChange({ ...point, x: Number(event.target.value) })} className="mt-1 w-full accent-[var(--color-accent)]"/></label>
    <label className="block text-xs text-white/60">Svisle: {point.y}%<input type="range" name="focalPointY" min="0" max="100" step="1" value={point.y} onChange={(event) => onChange({ ...point, y: Number(event.target.value) })} className="mt-1 w-full accent-[var(--color-accent)]"/></label>
  </>;
}

function ReplaceMediaAction({ area, assetId, usage, returnTo }: { area: AdminArea; assetId: string; usage: Usage; returnTo: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const allowSubmitRef = useRef(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const visibleReferences = usage.references.slice(0, 3);
  const remainingReferences = usage.references.length - visibleReferences.length;

  const requestConfirmation = (event: FormEvent<HTMLFormElement>) => {
    if (!usage.isUsed || allowSubmitRef.current) return;
    event.preventDefault();
    setConfirmationOpen(true);
  };
  const replaceEverywhere = () => {
    setIsReplacing(true);
    allowSubmitRef.current = true;
    formRef.current?.requestSubmit();
  };

  return <><form ref={formRef} action={replaceMediaAction} onSubmit={requestConfirmation} className="flex flex-wrap items-center gap-2"><input type="hidden" name="area" value={area}/><input type="hidden" name="assetId" value={assetId}/><input type="hidden" name="returnTo" value={returnTo}/><input type="file" name="file" accept={[...mediaUploadPolicy.allowedMimeTypes.keys()].join(',')} className="max-w-full text-xs text-white/72"/><PendingSubmitButton pendingLabel="Nahrazuji…" className="min-h-10 rounded-full border border-white/12 px-3.5 py-2 text-xs">Nahradit</PendingSubmitButton></form>{usage.isUsed ? <AlertDialog.Root open={confirmationOpen} onOpenChange={setConfirmationOpen}><AlertDialog.Portal><AlertDialog.Overlay className="z-[100]"/><AlertDialog.Content className="z-[110] rounded-[1.4rem] border border-white/10 bg-[#131116] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.45)] sm:p-6"><AlertDialog.Title>Nahradit používané médium?</AlertDialog.Title><AlertDialog.Description>Nový obrázek nahradí současný na všech místech použití.</AlertDialog.Description><p className="mt-2 text-sm text-white/72">Médium je použité na {usage.references.length} {usage.references.length === 1 ? 'místě' : 'místech'}.</p><ul className="mt-3 space-y-1 text-sm text-white/72">{visibleReferences.map((reference) => <li key={`${reference.source}-${reference.recordId}-${reference.field}`}>{usageLabel(reference)}</li>)}{remainingReferences > 0 ? <li>a další {remainingReferences} použití</li> : null}</ul><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><AlertDialog.Cancel asChild><button type="button" disabled={isReplacing} className="min-h-10 rounded-full border border-white/12 px-4 py-2 text-sm text-white/80">Zrušit</button></AlertDialog.Cancel><button type="button" disabled={isReplacing} onClick={replaceEverywhere} className="min-h-10 rounded-full border border-amber-200/25 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-50 disabled:cursor-wait disabled:opacity-65">{isReplacing ? 'Nahrazuji…' : 'Nahradit všude'}</button></div></AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root> : null}</>;
}

function PublishAction({ area, asset, usage, returnTo }: { area: AdminArea; asset: Asset; usage: Usage; returnTo: string }) {
  const formFields = <><input type="hidden" name="area" value={area}/><input type="hidden" name="assetId" value={asset.id}/><input type="hidden" name="returnTo" value={returnTo}/><input type="hidden" name="isPublished" value={asset.isPublished ? 'false' : 'true'}/></>;

  if (!requiresUnpublishConfirmation(asset.isPublished, usage.isUsed)) return <form action={updateMediaPublicationAction}>{formFields}<PendingSubmitButton pendingLabel="Ukládám…" className="min-h-10 rounded-full border border-white/12 px-3.5 py-2 text-xs">{asset.isPublished ? 'Zrušit publikaci' : 'Publikovat'}</PendingSubmitButton></form>;

  const visibleReferences = usage.references.slice(0, 3);
  const remainingReferences = usage.references.length - visibleReferences.length;
  return <AlertDialog.Root><AlertDialog.Trigger asChild><button type="button" className="min-h-10 rounded-full border border-white/12 px-3.5 py-2 text-xs">Zrušit publikaci</button></AlertDialog.Trigger><AlertDialog.Portal><AlertDialog.Overlay className="z-[100]"/><AlertDialog.Content className="z-[110] rounded-[1.4rem] border border-white/10 bg-[#131116] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.45)] sm:p-6"><AlertDialog.Title>Zrušit publikaci používaného média?</AlertDialog.Title><AlertDialog.Description>Médium je použité na {usage.references.length} {usage.references.length === 1 ? 'místě' : 'místech'}. Po zrušení publikace může zmizet z veřejného webu.</AlertDialog.Description><ul className="mt-3 space-y-1 text-sm text-white/72">{visibleReferences.map((reference) => <li key={`${reference.source}-${reference.recordId}-${reference.field}`}>{usageLabel(reference)}</li>)}{remainingReferences > 0 ? <li>a další {remainingReferences} {remainingReferences === 1 ? 'použití' : 'použití'}</li> : null}</ul><form action={updateMediaPublicationAction} className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{formFields}<AlertDialog.Cancel asChild><button type="button" className="min-h-10 rounded-full border border-white/12 px-4 py-2 text-sm text-white/80">Ponechat publikované</button></AlertDialog.Cancel><PendingSubmitButton pendingLabel="Ukládám…" className="min-h-10 rounded-full border border-amber-200/25 bg-amber-300/10 px-4 py-2 text-sm font-semibold text-amber-50">Zrušit publikaci</PendingSubmitButton></form></AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>;
}

function Memberships({ area, assetId, memberships, returnTo }: { area: AdminArea; assetId: string; memberships: Membership[]; returnTo: string }) {
  return <div className="space-y-2">{collections.map((collection) => {
    const membership = memberships.find((item) => item.type === collection.type);
    const supportsMove = collection.type === 'STUDIO_GALLERY' || collection.type === 'CERTIFICATES';
    const fields = () => <><input type="hidden" name="area" value={area}/><input type="hidden" name="assetId" value={assetId}/><input type="hidden" name="returnTo" value={returnTo}/><input type="hidden" name="collectionType" value={collection.type}/></>;
    return <div key={collection.type} className="flex flex-wrap items-center gap-2"><span className="w-24 text-xs text-white/75">{collection.label}</span>{membership ? <><form action={updateMediaCollectionMembershipAction} className="flex flex-wrap items-center gap-2">{fields()}<select aria-label={`Viditelnost v kolekci ${collection.label}`} name="isVisible" defaultValue={String(membership.isVisible)} className="rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-white"><option value="true">Viditelné</option><option value="false">Skryté</option></select><PendingSubmitButton name="action" value="save" pendingLabel="Ukládám…" className="text-xs text-[var(--color-accent-soft)]">Uložit</PendingSubmitButton><PendingSubmitButton name="action" value="remove" pendingLabel="Odebírám…" className="text-xs text-white/50">Odebrat zařazení</PendingSubmitButton></form>{supportsMove ? <div className="flex items-center gap-2"><form action={updateMediaCollectionMembershipAction}>{fields()}<input type="hidden" name="action" value="move"/><PendingSubmitButton name="direction" value="up" disabled={!membership.canMoveUp} pendingLabel="Přesouvám…" className="min-h-11 disabled:opacity-30">↑ Nahoru</PendingSubmitButton></form><form action={updateMediaCollectionMembershipAction}>{fields()}<input type="hidden" name="action" value="move"/><PendingSubmitButton name="direction" value="down" disabled={!membership.canMoveDown} pendingLabel="Přesouvám…" className="min-h-11 disabled:opacity-30">↓ Dolů</PendingSubmitButton></form></div> : null}</> : <form action={updateMediaCollectionMembershipAction}>{fields()}<PendingSubmitButton name="action" value="add" pendingLabel="Přidávám…" className="text-xs text-[var(--color-accent-soft)]">Zařadit</PendingSubmitButton></form>}</div>;
  })}</div>;
}

function DeleteAssetAction({ area, assetId, fileName, returnTo }: { area: AdminArea; assetId: string; fileName: string; returnTo: string }) {
  return <AlertDialog.Root><AlertDialog.Trigger asChild><button type="button" className="mt-3 min-h-10 rounded-full border border-red-300/25 bg-red-950/20 px-3.5 py-2 text-xs text-red-100">Odstranit médium</button></AlertDialog.Trigger><AlertDialog.Portal><AlertDialog.Overlay className="z-[100]"/><AlertDialog.Content className="z-[110] rounded-[1.4rem] border border-white/10 bg-[#131116] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.45)] sm:p-6"><AlertDialog.Title>Trvale odstranit médium?</AlertDialog.Title><AlertDialog.Description>Odstraní se médium „{fileName}“. Tuto operaci nelze vrátit.</AlertDialog.Description><form action={deleteMediaAction} className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><input type="hidden" name="area" value={area}/><input type="hidden" name="assetId" value={assetId}/><input type="hidden" name="returnTo" value={returnTo}/><AlertDialog.Cancel asChild><button type="button" className="min-h-10 rounded-full border border-white/12 px-4 py-2 text-sm text-white/80">Zrušit</button></AlertDialog.Cancel><PendingSubmitButton pendingLabel="Odstraňuji…" className="min-h-10 rounded-full border border-red-300/25 bg-red-950/40 px-4 py-2 text-sm font-semibold text-red-50">Trvale odstranit</PendingSubmitButton></form></AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>;
}
