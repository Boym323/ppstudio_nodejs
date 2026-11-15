'use client';

import { useState } from 'react';
import * as Dialog from '@/components/ui/dialog';
import { uploadMediaAction } from '@/features/admin/actions/media-actions';
import { MediaUploadDropzone } from '@/features/admin/components/media-upload-dropzone';
import { PendingSubmitButton } from '@/features/admin/components/pending-submit-button';
import { type AdminArea } from '@/config/navigation';

type UploadAction = (formData: FormData) => void | Promise<void>;

type MediaUploadDialogProps = {
  area: AdminArea;
  returnTo?: string;
  accept: string;
  supportedTypes: string;
  maxFileSizeMb: number;
  action?: UploadAction;
  multiple?: boolean;
  serviceId?: string;
  collectionType?: 'STUDIO_GALLERY' | 'CERTIFICATES' | 'REFERENCES';
  serviceRole?: 'HERO' | 'GALLERY';
};

export function MediaUploadDialog({ area, returnTo = '', accept, supportedTypes, maxFileSizeMb, action = uploadMediaAction, multiple = true, serviceId, serviceRole, collectionType }: MediaUploadDialogProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [dialogKey, setDialogKey] = useState(0);
  const collectionLabel = collectionType === 'STUDIO_GALLERY' ? 'Studio' : collectionType === 'CERTIFICATES' ? 'Certifikáty' : 'Reference';
  return (
    <Dialog.Root key={dialogKey} onOpenChange={(open) => { if (!open) { setFiles([]); setDialogKey((value) => value + 1); } }}>
      <Dialog.Trigger asChild>
        <button type="button" className="min-h-11 rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]">Nahrát</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="max-w-2xl rounded-[1.7rem] border border-white/10 bg-[#131116] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.45)] sm:p-6">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <Dialog.Title>Nahrát médium</Dialog.Title>
              <Dialog.Description>{collectionType ? `Soubory můžete uložit jako neveřejné, nebo je publikovat a přidat do kolekce ${collectionLabel}.` : 'Nové médium zůstane neveřejné, dokud vědomě nepotvrdíte publikaci.'}</Dialog.Description>
            </div>
            <Dialog.Close asChild><button type="button" className="min-h-11 shrink-0 rounded-full border border-white/10 px-3 py-2 text-sm text-white/72 transition hover:border-white/18 hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">Zavřít</button></Dialog.Close>
          </div>
          <form action={action} className="mt-5 space-y-4">
            <input type="hidden" name="area" value={area}/>
            <input type="hidden" name="returnTo" value={returnTo}/>
            {collectionType ? <input type="hidden" name="collectionType" value={collectionType}/> : null}
            {serviceId ? <><input type="hidden" name="serviceId" value={serviceId}/><input type="hidden" name="serviceRole" value={serviceRole ?? 'GALLERY'}/></> : null}
            <MediaUploadDropzone name={multiple ? 'files' : 'file'} accept={accept} supportedTypes={supportedTypes} multiple={multiple} onFilesChange={setFiles}/>
            {files.length > (multiple ? 8 : 1) ? <p role="alert" className="text-sm text-red-200">Vyberte nejvýše {multiple ? 8 : 1} souborů.</p> : null}
            <p className="text-xs text-white/56">Podporované typy: {supportedTypes}. Maximální velikost souboru: {maxFileSizeMb} MB.</p>
            {multiple && files.length > 0 ? <div className="max-h-64 space-y-3 overflow-y-auto">
              {files.map((file, index) => <fieldset key={`${file.name}-${file.lastModified}-${index}`} className="grid gap-2 rounded-xl border border-white/10 p-3 sm:grid-cols-2">
                <legend className="max-w-full truncate px-1 text-xs text-white/70">{file.name}</legend>
                <label className="text-xs text-white/55">Název<input name={`title.${index}`} defaultValue={file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 120)} maxLength={120} className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"/></label>
                <label className="text-xs text-white/55">Alt text<input name={`altText.${index}`} maxLength={160} placeholder="Popis obsahu fotografie" className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"/></label>
              </fieldset>)}
              <input type="hidden" name="title" value=""/><input type="hidden" name="altText" value=""/>
            </div> : <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-white/55">Titulek<input name="title" maxLength={120} className="mt-1.5 w-full rounded-[.95rem] border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"/></label>
              <label className="text-xs text-white/55">Výchozí alt text<input name="altText" maxLength={160} className="mt-1.5 w-full rounded-[.95rem] border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"/></label>
            </div>}
            <label className="flex items-start gap-3 rounded-[.95rem] border border-white/10 bg-white/[.03] px-3 py-2.5 text-xs text-white/72"><input type="checkbox" name="isPublished" value="true" className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"/><span><strong className="font-semibold text-white">{collectionType ? `Publikovat a přidat do kolekce ${collectionLabel}` : 'Publikovat ihned'}</strong><span className="mt-0.5 block text-white/52">{collectionType ? 'Bez zaškrtnutí se soubory uloží jen do knihovny. Po nahrání je uvidíte v přehledu nových souborů.' : 'Publikace zpřístupní soubor, ale sama jej neumístí na stránku webu.'}</span></span></label>
            <div className="flex justify-end"><PendingSubmitButton disabled={files.length === 0 || files.length > (multiple ? 8 : 1)} pendingLabel="Nahrávám a zpracovávám…" className="min-h-11 rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] disabled:cursor-not-allowed disabled:opacity-60">Nahrát</PendingSubmitButton></div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
