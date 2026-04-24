import Image from 'next/image';
import Link from 'next/link';
import { MediaType } from '@prisma/client';

import { type AdminArea } from '@/config/navigation';
import { deleteMediaAction, updateMediaAction, uploadMediaAction } from '@/features/admin/actions/media-actions';
import {
  getMediaAdminPath,
  getMediaTypeLabel,
  getMediaUsageLabel,
  mediaFilterSchema,
} from '@/features/admin/lib/admin-media-validation';
import { AdminPageShell, AdminPanel } from '@/features/admin/components/admin-page-shell';
import { listMedia } from '@/features/media/lib/media-library';

const filterTabs = [
  { value: 'ALL', label: 'Vše' },
  { value: MediaType.CERTIFICATE, label: 'Certifikáty' },
  { value: MediaType.SALON_PHOTO, label: 'Prostory' },
  { value: MediaType.PORTRAIT, label: 'Portréty' },
] as const;

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
    case 'media-upload-success':
      return { tone: 'success' as const, message: 'Obrázek byl nahraný.' };
    case 'media-update-success':
      return { tone: 'success' as const, message: 'Médium bylo upravené.' };
    case 'media-delete-success':
      return { tone: 'success' as const, message: 'Médium bylo odstraněné.' };
    case 'media-upload-missing-file':
      return { tone: 'error' as const, message: 'Vyberte prosím obrázek.' };
    case 'media-upload-empty-file':
      return { tone: 'error' as const, message: 'Nahraný soubor je prázdný.' };
    case 'media-upload-too-large':
      return { tone: 'error' as const, message: 'Soubor je příliš velký. Limit je 8 MB.' };
    case 'media-upload-invalid-type':
      return {
        tone: 'error' as const,
        message: 'Nepodporovaný typ souboru. Použijte JPG, PNG, WEBP, GIF nebo SVG.',
      };
    case 'media-upload-failed':
      return { tone: 'error' as const, message: 'Nahrání selhalo. Zkuste to prosím znovu.' };
    default:
      return null;
  }
}

type MediaAssetItem = Awaited<ReturnType<typeof listMedia>>[number];

export async function AdminMediaPage({
  area,
  searchParams,
}: {
  area: AdminArea;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const flash = typeof searchParams?.flash === 'string' ? searchParams.flash : undefined;
  const rawType = typeof searchParams?.type === 'string' ? searchParams.type : 'ALL';
  const activeFilter = mediaFilterSchema.safeParse(rawType).success ? mediaFilterSchema.parse(rawType) : 'ALL';
  const selectedType = activeFilter === 'ALL' ? undefined : activeFilter;
  const assets = await listMedia(selectedType);
  const publishedCertificates = (await listMedia(MediaType.CERTIFICATE)).filter((asset) => asset.isPublished).length;
  const notification = flashMessage(flash);

  return (
    <AdminPageShell
      eyebrow={area === 'owner' ? 'Média webu' : 'Provozní média'}
      title="Média webu"
      description={
        area === 'owner'
          ? 'Jednoduchá správa obrázků pro web. Certifikáty zůstávají napojené na stránku O mně, další typy jsou připravené pro rozšíření.'
          : 'Rychlé nahrání a úprava obrázků používaných na webu.'
      }
      stats={[
        {
          label: 'Publikované certifikáty',
          value: String(publishedCertificates),
          tone: 'accent',
          detail: 'Stránka O mně načítá jen publikované certifikáty.',
        },
        {
          label: 'Zobrazeno v knihovně',
          value: String(assets.length),
          tone: 'muted',
          detail: activeFilter === 'ALL' ? 'Všechny typy médií.' : getMediaTypeLabel(activeFilter),
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

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <MediaUploadForm area={area} />
        <AdminPanel
          title="Knihovna obrázků"
          description="Filtrování je podle typu média. Pořadí zatím zůstává podle data nahrání."
          compact={area === 'salon'}
        >
          <MediaFilterTabs area={area} activeFilter={activeFilter} />
          <MediaGrid area={area} assets={assets} />
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}

export function MediaUploadForm({ area }: { area: AdminArea }) {
  return (
    <AdminPanel
      title="Nahrát obrázek"
      description="Výchozí typ je Certifikát, aby stávající workflow zůstalo rychlé."
      compact={area === 'salon'}
    >
      <form action={uploadMediaAction} className="space-y-4">
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
          <span className="text-sm font-medium text-white">Typ</span>
          <select
            name="type"
            defaultValue={MediaType.CERTIFICATE}
            className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
          >
            <option value={MediaType.CERTIFICATE}>Certifikáty</option>
            <option value={MediaType.SALON_PHOTO}>Prostory</option>
            <option value={MediaType.PORTRAIT}>Portréty</option>
            <option value={MediaType.GENERAL}>Obecné</option>
          </select>
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
            name="altText"
            maxLength={160}
            className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
            placeholder="Krátký popis obrázku pro přístupnost"
          />
        </label>

        <button
          type="submit"
          className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
        >
          Nahrát obrázek
        </button>
      </form>
    </AdminPanel>
  );
}

export function MediaFilterTabs({ area, activeFilter }: { area: AdminArea; activeFilter: string }) {
  const basePath = getMediaAdminPath(area);

  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {filterTabs.map((tab) => {
        const href = tab.value === 'ALL' ? basePath : `${basePath}?type=${tab.value}`;
        const active = activeFilter === tab.value;

        return (
          <Link
            key={tab.value}
            href={href}
            className={
              active
                ? 'rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#15100d]'
                : 'rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/72 transition hover:bg-white/10 hover:text-white'
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export function MediaGrid({ area, assets }: { area: AdminArea; assets: MediaAssetItem[] }) {
  if (assets.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-white/14 bg-white/4 p-5">
        <p className="text-base font-medium text-white">Zatím tu není žádný obrázek.</p>
        <p className="mt-2 text-sm leading-6 text-white/62">Nahrajte první soubor ve formuláři vedle seznamu.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {assets.map((asset) => (
        <MediaCard key={asset.id} area={area} asset={asset} />
      ))}
    </div>
  );
}

export function MediaCard({ area, asset }: { area: AdminArea; asset: MediaAssetItem }) {
  return (
    <article className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/5">
      <div className="relative h-44 overflow-hidden border-b border-white/10 bg-black/20">
        {asset.thumbnailPublicUrl ? (
          <Image
            src={asset.thumbnailPublicUrl}
            alt={asset.altText ?? asset.title ?? asset.fileName}
            fill
            className="object-cover"
            sizes="(min-width: 1536px) 20vw, (min-width: 768px) 35vw, 90vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/45">Nepublikováno</div>
        )}
      </div>

      <div className="space-y-4 p-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h4 className="break-all text-base font-medium text-white">{asset.title ?? asset.fileName}</h4>
            <span className="shrink-0 rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
              {asset.isPublished ? 'Publikováno' : 'Nepublikováno'}
            </span>
          </div>
          <p className="mt-1 break-all text-xs text-white/50">{asset.fileName}</p>
          <p className="mt-2 text-sm text-white/62">
            {getMediaTypeLabel(asset.type)} • {asset.width && asset.height ? `${asset.width} x ${asset.height}` : 'Rozměry neznámé'} • {formatBytes(asset.size)}
          </p>
          <p className="mt-2 text-sm text-white/72">Použití: {getMediaUsageLabel(asset.type)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <MediaEditDialog area={area} asset={asset} />
          <form action={deleteMediaAction}>
            <input type="hidden" name="area" value={area} />
            <input type="hidden" name="assetId" value={asset.id} />
            <button
              type="submit"
              className="rounded-full border border-red-300/25 bg-red-400/10 px-4 py-2 text-sm font-medium text-red-50 transition hover:bg-red-400/20"
            >
              Odstranit
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}

export function MediaEditDialog({ area, asset }: { area: AdminArea; asset: MediaAssetItem }) {
  return (
    <details className="group relative">
      <summary className="list-none rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/12 [&::-webkit-details-marker]:hidden">
        Upravit
      </summary>
      <div className="absolute left-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-[1.25rem] border border-white/12 bg-[#15100d] p-4 shadow-2xl">
        <form action={updateMediaAction} className="space-y-3">
          <input type="hidden" name="area" value={area} />
          <input type="hidden" name="assetId" value={asset.id} />

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">Titulek</span>
            <input
              type="text"
              name="title"
              defaultValue={asset.title ?? ''}
              maxLength={120}
              className="mt-1 w-full rounded-[0.9rem] border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-accent)]/60"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">Alt text</span>
            <input
              type="text"
              name="altText"
              defaultValue={asset.altText ?? ''}
              maxLength={160}
              className="mt-1 w-full rounded-[0.9rem] border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-accent)]/60"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">Typ</span>
            <select
              name="type"
              defaultValue={asset.type}
              className="mt-1 w-full rounded-[0.9rem] border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-accent)]/60"
            >
              <option value={MediaType.CERTIFICATE}>Certifikáty</option>
              <option value={MediaType.SALON_PHOTO}>Prostory</option>
              <option value={MediaType.PORTRAIT}>Portréty</option>
              <option value={MediaType.GENERAL}>Obecné</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">Publikace</span>
            <select
              name="isPublished"
              defaultValue={asset.isPublished ? 'true' : 'false'}
              className="mt-1 w-full rounded-[0.9rem] border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-accent)]/60"
            >
              <option value="true">Publikováno</option>
              <option value="false">Nepublikováno</option>
            </select>
          </label>

          <button
            type="submit"
            className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
          >
            Uložit
          </button>
        </form>
      </div>
    </details>
  );
}

export const AdminCertificatesPage = AdminMediaPage;
