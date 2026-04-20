import Image from 'next/image';
import { MediaAssetKind, MediaAssetVisibility } from '@prisma/client';

import { type AdminArea } from '@/config/navigation';
import {
  deleteCertificateAction,
  uploadCertificateAction,
} from '@/features/admin/actions/certificate-actions';
import { AdminPageShell, AdminPanel } from '@/features/admin/components/admin-page-shell';
import { getMediaLibraryByKind } from '@/features/media/lib/media-library';

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  const kib = value / 1024;

  if (kib < 1024) {
    return `${kib.toFixed(1)} KB`;
  }

  return `${(kib / 1024).toFixed(1)} MB`;
}

function flashMessage(flash: string | undefined) {
  switch (flash) {
    case 'certificate-upload-success':
      return { tone: 'success' as const, message: 'Certifikát byl nahraný.' };
    case 'certificate-delete-success':
      return { tone: 'success' as const, message: 'Certifikát byl odstraněný.' };
    case 'certificate-upload-missing-file':
      return { tone: 'error' as const, message: 'Vyberte prosím soubor certifikátu.' };
    case 'certificate-upload-empty-file':
      return { tone: 'error' as const, message: 'Nahraný soubor je prázdný.' };
    case 'certificate-upload-too-large':
      return { tone: 'error' as const, message: 'Soubor je příliš velký. Limit je 8 MB.' };
    case 'certificate-upload-invalid-type':
      return {
        tone: 'error' as const,
        message: 'Nepodporovaný typ souboru. Použijte JPG, PNG, WEBP, GIF nebo SVG.',
      };
    case 'certificate-delete-not-found':
      return { tone: 'error' as const, message: 'Certifikát už v systému neexistuje.' };
    case 'certificate-upload-failed':
      return { tone: 'error' as const, message: 'Nahrání selhalo. Zkuste to prosím znovu.' };
    default:
      return null;
  }
}

export async function AdminCertificatesPage({
  area,
  searchParams,
}: {
  area: AdminArea;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const flash = typeof searchParams?.flash === 'string' ? searchParams.flash : undefined;
  const notification = flashMessage(flash);
  const certificateAssets = (await getMediaLibraryByKind(MediaAssetKind.CERTIFICATE)).filter(
    (asset) => asset.visibility === MediaAssetVisibility.PUBLIC,
  );

  return (
    <AdminPageShell
      eyebrow={area === 'owner' ? 'Média webu' : 'Provozní média'}
      title="Certifikáty"
      description={
        area === 'owner'
          ? 'Nahrávejte certifikáty pro stránku O mně. Soubory se ukládají lokálně mimo repozitář a metadata zůstávají v databázi.'
          : 'Rychlé nahrání certifikátů, které se zobrazují na veřejné stránce O mně.'
      }
      stats={[
        {
          label: 'Publikované certifikáty',
          value: String(certificateAssets.length),
          tone: 'accent',
          detail: 'Veřejné soubory dostupné přes media URL.',
        },
      ]}
      compact={area === 'salon'}
    >
      {notification ? (
        <div
          className={
            notification.tone === 'success'
              ? 'rounded-[1.25rem] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-50'
              : 'rounded-[1.25rem] border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-50'
          }
        >
          {notification.message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AdminPanel
          title="Nahrát certifikát"
          description="Po nahrání se certifikát hned objeví na stránce O mně i v seznamu vpravo."
          compact={area === 'salon'}
        >
          <form action={uploadCertificateAction} className="space-y-4">
            <input type="hidden" name="area" value={area} />

            <label className="block">
              <span className="text-sm font-medium text-white">Soubor</span>
              <input
                type="file"
                name="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white file:mr-3 file:rounded-full file:border-0 file:bg-[var(--color-accent)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[var(--color-accent-contrast)]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white">Titulek (volitelné)</span>
              <input
                type="text"
                name="title"
                maxLength={120}
                className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
                placeholder="Např. Lash Lifting Masterclass"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white">Alt text (volitelné)</span>
              <input
                type="text"
                name="alt"
                maxLength={160}
                className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
                placeholder="Např. Certifikát Lash Lifting"
              />
            </label>

            <button
              type="submit"
              className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
            >
              Nahrát certifikát
            </button>
          </form>
        </AdminPanel>

        <AdminPanel
          title="Aktuální certifikáty"
          description="Správa pořadí je zatím podle data nahrání (nejnovější nahoře)."
          compact={area === 'salon'}
        >
          {certificateAssets.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-white/14 bg-white/4 p-5">
              <p className="text-base font-medium text-white">Zatím tu není žádný certifikát.</p>
              <p className="mt-2 text-sm leading-6 text-white/62">Nahrajte první soubor v levém panelu.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {certificateAssets.map((asset) => (
                <article
                  key={asset.id}
                  className="grid gap-4 rounded-[1.4rem] border border-white/10 bg-white/5 p-4 sm:grid-cols-[8rem_minmax(0,1fr)]"
                >
                  <div className="overflow-hidden rounded-[1rem] border border-white/10 bg-black/20">
                    {asset.publicUrl ? (
                      <Image
                        src={asset.publicUrl}
                        alt={asset.alt ?? asset.title ?? asset.originalFilename}
                        width={asset.width ?? 640}
                        height={asset.height ?? 480}
                        className="h-32 w-full object-cover"
                        sizes="128px"
                      />
                    ) : (
                      <div className="flex h-32 items-center justify-center text-xs text-white/45">Bez náhledu</div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h4 className="text-base font-medium text-white">{asset.title ?? asset.originalFilename}</h4>
                      <p className="mt-1 text-sm text-white/62">
                        {asset.mimeType} • {formatBytes(asset.sizeBytes)}
                        {asset.width && asset.height ? ` • ${asset.width} x ${asset.height}` : ''}
                      </p>
                      {asset.alt ? <p className="mt-1 text-sm text-white/72">Alt: {asset.alt}</p> : null}
                    </div>

                    <form action={deleteCertificateAction}>
                      <input type="hidden" name="area" value={area} />
                      <input type="hidden" name="assetId" value={asset.id} />
                      <button
                        type="submit"
                        className="rounded-full border border-red-300/25 bg-red-400/10 px-4 py-2 text-sm font-medium text-red-50 transition hover:bg-red-400/20"
                      >
                        Odstranit certifikát
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}
