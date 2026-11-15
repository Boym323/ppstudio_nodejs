'use client';

/* eslint-disable @next/next/no-img-element -- Lokální Blob URL je určená pouze pro náhled před uploadem. */

import { useEffect, useId, useMemo, useRef, useState } from 'react';

type MediaUploadDropzoneProps = {
  name: string;
  accept: string;
  supportedTypes: string;
  multiple?: boolean;
  onFilesChange?: (files: File[]) => void;
};

export function MediaUploadDropzone({ name, accept, supportedTypes, multiple = false, onFilesChange }: MediaUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const inputId = useId();

  function syncSelectedFiles() {
    const files = Array.from(inputRef.current?.files ?? []);
    setSelectedFiles(files);
    onFilesChange?.(files);
  }

  const previewUrls = useMemo(() => selectedFiles.slice(0, 6).map((file) => {
    if (!file.type.startsWith('image/') || file.type === 'image/heic' || file.type === 'image/heif') return null;
    return encodeURI(URL.createObjectURL(file));
  }), [selectedFiles]);

  useEffect(() => () => previewUrls.forEach((url) => { if (url) URL.revokeObjectURL(url); }), [previewUrls]);

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);

          if (!inputRef.current || event.dataTransfer.files.length === 0) {
            return;
          }

          inputRef.current.files = event.dataTransfer.files;
          syncSelectedFiles();
        }}
        className={
          isDragging
            ? 'flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-[1.3rem] border border-[var(--color-accent)]/55 bg-[rgba(190,160,120,0.12)] px-5 py-6 text-center shadow-[0_18px_45px_rgba(0,0,0,0.18)] transition'
            : 'flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-[1.3rem] border border-dashed border-white/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-5 py-6 text-center shadow-[0_18px_45px_rgba(0,0,0,0.16)] transition hover:border-[var(--color-accent)]/40 hover:bg-[rgba(255,255,255,0.06)]'
        }
      >
        <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/72">
          Nahrání obrázku
        </div>
        <p className="mt-4 text-sm font-semibold text-white sm:text-base">
          Přetáhněte obrázek nebo klikněte pro výběr
        </p>
        <p className="mt-1 text-xs text-white/56">{supportedTypes}</p>
        <p className="mt-4 min-h-5 text-sm text-[var(--color-accent-soft)]">
          {selectedFiles.length ? `${selectedFiles.length} soubor${selectedFiles.length === 1 ? '' : 'ů'}: ${selectedFiles.slice(0, 2).map((file) => file.name).join(', ')}${selectedFiles.length > 2 ? '…' : ''}` : 'Zatím není vybraný žádný soubor'}
        </p>
      </label>

      {previewUrls.some(Boolean) ? <div className="grid grid-cols-3 gap-2">{previewUrls.map((url, index) => url ? <img key={url} src={url} alt={`Náhled souboru ${index + 1}`} className="aspect-square w-full rounded-[.8rem] border border-white/10 object-cover"/> : null)}</div> : null}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        name={name}
        accept={accept}
        onChange={syncSelectedFiles}
        multiple={multiple}
        className="sr-only"
      />
    </div>
  );
}
