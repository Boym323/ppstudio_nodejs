'use client';

import * as Dialog from '@/components/ui/dialog';
import { uploadMediaAction } from '@/features/admin/actions/media-actions';
import { MediaUploadDropzone } from '@/features/admin/components/media-upload-dropzone';
import { PendingSubmitButton } from '@/features/admin/components/pending-submit-button';
import { type AdminArea } from '@/config/navigation';

type MediaUploadDialogProps = {
  area: AdminArea;
  returnTo: string;
  accept: string;
  supportedTypes: string;
  maxFileSizeMb: number;
};

export function MediaUploadDialog({ area, returnTo, accept, supportedTypes, maxFileSizeMb }: MediaUploadDialogProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button type="button" className="min-h-11 rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]">Nahrát</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="max-w-2xl rounded-[1.7rem] border border-white/10 bg-[#131116] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.45)] sm:p-6">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <Dialog.Title>Nahrát médium</Dialog.Title>
              <Dialog.Description>Nové médium bude po nahrání publikované.</Dialog.Description>
            </div>
            <Dialog.Close asChild><button type="button" className="min-h-11 shrink-0 rounded-full border border-white/10 px-3 py-2 text-sm text-white/72 transition hover:border-white/18 hover:bg-white/6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">Zavřít</button></Dialog.Close>
          </div>
          <form action={uploadMediaAction} className="mt-5 space-y-4">
            <input type="hidden" name="area" value={area}/>
            <input type="hidden" name="returnTo" value={returnTo}/>
            <MediaUploadDropzone name="file" accept={accept} supportedTypes={supportedTypes}/>
            <p className="text-xs text-white/56">Podporované typy: {supportedTypes}. Maximální velikost souboru: {maxFileSizeMb} MB.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-white/55">Titulek<input name="title" maxLength={120} className="mt-1.5 w-full rounded-[.95rem] border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"/></label>
              <label className="text-xs text-white/55">Výchozí alt text<input name="altText" maxLength={160} className="mt-1.5 w-full rounded-[.95rem] border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"/></label>
            </div>
            <div className="flex justify-end"><PendingSubmitButton pendingLabel="Nahrávám a zpracovávám…" className="min-h-11 rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] disabled:cursor-not-allowed disabled:opacity-60">Nahrát</PendingSubmitButton></div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
