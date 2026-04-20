'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

import type { PublicCertificate } from '@/features/public/lib/public-certificates';

export function AboutCertificatesGallery({ certificates }: { certificates: PublicCertificate[] }) {
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
            className="overflow-hidden rounded-[calc(var(--radius-panel)-0.45rem)] border border-[#e6dbcf] bg-[#fffcf8]"
          >
            <button
              type="button"
              onClick={() => setSelectedId(certificate.id)}
              className="block w-full text-left"
            >
              <div className="relative h-56 w-full bg-[#f2e9dc] p-2">
                <Image
                  src={certificate.imageUrl}
                  alt={certificate.alt ?? certificate.title ?? 'Certifikát'}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-contain p-2"
                />
              </div>
              <div className="p-4">
                <h3 className="font-medium text-[var(--color-foreground)]">
                  {certificate.title ?? 'Certifikát'}
                </h3>
                <p className="mt-2 text-sm text-[var(--color-muted)]">Klikněte pro zvětšení</p>
              </div>
            </button>
          </article>
        ))}
      </div>

      {selectedCertificate ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/78 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-label={selectedCertificate.title ?? 'Náhled certifikátu'}
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
                alt={selectedCertificate.alt ?? selectedCertificate.title ?? 'Certifikát'}
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
