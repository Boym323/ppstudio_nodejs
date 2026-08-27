'use client';

import Image from 'next/image';

import * as Dialog from '@/components/ui/dialog';

export type AboutCertificateGalleryItem = {
  id: string;
  title: string;
  hint: string;
  alt: string;
  imageUrl?: string | null;
  width?: number;
  height?: number;
};

function CertificateDialog({ certificate }: { certificate: AboutCertificateGalleryItem }) {
  return (
    <Dialog.Root>
      <article
        className="group overflow-hidden rounded-[calc(var(--radius-panel)-0.45rem)] border border-[#e6dbcf] bg-[#fffdf9] shadow-[var(--shadow-panel)] transition duration-200 hover:-translate-y-0.5 hover:border-[#ddcfbf] hover:bg-white hover:shadow-[0_24px_60px_rgba(34,22,12,0.12)]"
      >
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="block w-full text-left"
            disabled={!certificate.imageUrl}
          >
            <div className="flex h-44 w-full items-center justify-center overflow-hidden bg-[linear-gradient(160deg,#f6eee5_0%,#f1e5d7_52%,#eadbc9_100%)] p-3 sm:h-48 lg:h-52 xl:h-44">
              {certificate.imageUrl ? (
                <Image
                  src={certificate.imageUrl}
                  alt={certificate.alt}
                  width={certificate.width ?? 900}
                  height={certificate.height ?? 640}
                  sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 31vw, (min-width: 640px) 50vw, 100vw"
                  className="h-auto max-h-full w-auto max-w-full object-contain transition duration-300 group-hover:scale-[1.015]"
                />
              ) : (
                <div className="relative flex h-full w-full items-end rounded-[1.1rem] border border-white/60 bg-white/50 p-4">
                  <div className="absolute left-[10%] top-[14%] h-16 w-16 rounded-full bg-white/40 blur-2xl" />
                  <div className="absolute right-[8%] top-[20%] h-24 w-24 rounded-full bg-[#e8d5c0]/45 blur-3xl" />
                  <div className="relative space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">Certifikace</p>
                    <p className="font-display text-2xl leading-[1.05] text-[var(--color-foreground)]">Náhled bude doplněný z adminu</p>
                  </div>
                </div>
              )}
            </div>
            <div className="p-3.5">
              <h3 className="font-display text-[1.15rem] leading-[1.08] text-[var(--color-foreground)] sm:text-[1.25rem]">{certificate.title}</h3>
              <p className="mt-1.5 text-[12px] leading-5 text-[var(--color-muted)]">{certificate.hint}</p>
            </div>
          </button>
        </Dialog.Trigger>
      </article>

      {certificate.imageUrl ? (
        <Dialog.Portal>
          <Dialog.Overlay className="z-[120] bg-black/78 backdrop-blur-none" />
          <Dialog.Content className="!inset-0 !z-[130] !flex !h-auto !max-h-none !w-auto !max-w-none !translate-x-0 !translate-y-0 items-center justify-center !overflow-visible px-4 py-6">
            <div className="relative w-full max-w-5xl">
              <Dialog.Title className="sr-only">{certificate.title}</Dialog.Title>
              <Dialog.Description className="sr-only">{certificate.hint}</Dialog.Description>
              <Dialog.Close asChild>
                <button type="button" className="absolute -top-12 right-0 rounded-full border border-white/25 bg-black/30 px-4 py-2 text-sm text-white hover:bg-black/45">
                  Zavřít náhled certifikátu
                </button>
              </Dialog.Close>
              <div className="relative h-[78vh] w-full overflow-hidden rounded-[1.25rem] border border-white/20 bg-black/25">
                <Image src={certificate.imageUrl} alt={certificate.alt} fill sizes="90vw" className="object-contain" priority />
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      ) : null}
    </Dialog.Root>
  );
}

export function AboutCertificatesGallery({ certificates }: { certificates: AboutCertificateGalleryItem[] }) {
  return (
    <div className="mt-6 grid gap-3.5 sm:grid-cols-2 lg:mt-7 lg:grid-cols-3 xl:grid-cols-5">
      {certificates.map((certificate) => (
        <CertificateDialog key={certificate.id} certificate={certificate} />
      ))}
    </div>
  );
}
