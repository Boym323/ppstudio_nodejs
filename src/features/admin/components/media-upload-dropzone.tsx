'use client';

import { useId, useRef, useState } from 'react';

type MediaUploadDropzoneProps = {
  name: string;
  accept: string;
};

export function MediaUploadDropzone({ name, accept }: MediaUploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const inputId = useId();

  function syncSelectedFile() {
    setSelectedFileName(inputRef.current?.files?.[0]?.name ?? null);
  }

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
          syncSelectedFile();
        }}
        className={
          isDragging
            ? 'flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-[1.3rem] border border-[var(--color-accent)]/55 bg-[rgba(190,160,120,0.12)] px-5 py-6 text-center shadow-[0_18px_45px_rgba(0,0,0,0.18)] transition'
            : 'flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-[1.3rem] border border-dashed border-white/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] px-5 py-6 text-center shadow-[0_18px_45px_rgba(0,0,0,0.16)] transition hover:border-[var(--color-accent)]/40 hover:bg-[rgba(255,255,255,0.06)]'
        }
      >
        <div className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/72">
          Upload obrázku
        </div>
        <p className="mt-4 text-sm font-semibold text-white sm:text-base">
          Přetáhněte obrázek nebo klikněte pro výběr
        </p>
        <p className="mt-1 text-xs text-white/56">JPG, PNG nebo WebP</p>
        <p className="mt-4 min-h-5 text-sm text-[var(--color-accent-soft)]">
          {selectedFileName ?? 'Zatím není vybraný žádný soubor'}
        </p>
      </label>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        name={name}
        accept={accept}
        onChange={syncSelectedFile}
        className="sr-only"
      />
    </div>
  );
}
