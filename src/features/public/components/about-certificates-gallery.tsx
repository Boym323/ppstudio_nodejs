'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export type AboutCertificateGalleryItem = {
  id: string;
  title: string;
  hint: string;
  alt: string;
  imageUrl?: string | null;
};

export function AboutCertificatesGallery({ certificates }: { certificates: AboutCertificateGalleryItem[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedCertificate = certificates.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedCertificate) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSelectedId(null);
      }
    }

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedCertificate]);

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {certificates.map((certificate) => (
          <article
            key={certificate.id}
            className="overflow-hidden rounded-[calc(var(--radius-panel)-0.45rem)] border border-[#e6dbcf] bg-[#fffcf8] shadow-[var(--shadow-panel)]"
          >
            <button
              type="button"
              onClick={() => {
                if (certificate.imageUrl) {
                  setSelectedId(certificate.id);
                }
              }}
              className="block w-full text-left"
              aria-disabled={!certificate.imageUrl}
            >
              <div className="relative h-56 w-full overflow-hidden bg-[linear-gradient(160deg,#f6eee5_0%,#f1e5d7_52%,#eadbc9_100%)] p-3">
                {certificate.imageUrl ? (
                  <Image
                    src={certificate.imageUrl}
                    alt={certificate.alt}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-contain p-3"
                  />
                ) : (
                  <div className="relative flex h-full items-end rounded-[1.35rem] border border-white/60 bg-white/50 p-5">
                    <div className="absolute left-[10%] top-[14%] h-16 w-16 rounded-full bg-white/40 blur-2xl" />
                    <div className="absolute right-[8%] top-[20%] h-24 w-24 rounded-full bg-[#e8d5c0]/45 blur-3xl" />
                    <div className="relative space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
                        Certifikace
                      </p>
                      <p className="font-display text-2xl leading-[1.05] text-[var(--color-foreground)]">
                        Náhled bude doplněný z adminu
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-medium text-[var(--color-foreground)]">{certificate.title}</h3>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{certificate.hint}</p>
              </div>
            </button>
          </article>
        ))}
      </div>

      {selectedCertificate?.imageUrl ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/78 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-label={selectedCertificate.title}
          onClick={() => setSelectedId(null)}
        >
          <div className="relative w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="absolute -top-12 right-0 rounded-full border border-white/25 bg-black/30 px-4 py-2 text-sm text-white hover:bg-black/45"
            >
              Zavřít
            </button>

            <div className="relative h-[78vh] w-full overflow-hidden rounded-[1.25rem] border border-white/20 bg-black/25">
              <Image
                src={selectedCertificate.imageUrl}
                alt={selectedCertificate.alt}
                fill
                sizes="90vw"
                className="object-contain"
                priority
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
