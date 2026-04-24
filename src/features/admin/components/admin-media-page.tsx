import Image from 'next/image';
import Link from 'next/link';
import { MediaType } from '@prisma/client';

import { type AdminArea } from '@/config/navigation';
import { deleteMediaAction, updateMediaAction, uploadMediaAction } from '@/features/admin/actions/media-actions';
import { AdminPageShell, AdminPanel } from '@/features/admin/components/admin-page-shell';
import { MediaUploadDropzone } from '@/features/admin/components/media-upload-dropzone';
import {
  getMediaAdminPath,
  getMediaTypeLabel,
  getMediaUsageLabel,
  getMediaUsageSectionLabel,
  mediaFilterSchema,
} from '@/features/admin/lib/admin-media-validation';
import { listMedia } from '@/features/media/lib/media-library';

type FilterTabValue = 'ALL' | MediaType;

const filterTabs: Array<{ value: FilterTabValue; label: string }> = [
  { value: 'ALL', label: 'Vše' },
  { value: MediaType.CERTIFICATE, label: 'Certifikáty' },
  { value: MediaType.SALON_PHOTO, label: 'Prostory' },
  { value: MediaType.PORTRAIT_HOME, label: 'Portrét Homepage' },
  { value: MediaType.PORTRAIT_ABOUT, label: 'Portrét O mně' },
  { value: MediaType.PORTRAIT, label: 'Portrét Legacy' },
  { value: MediaType.GENERAL, label: 'Obecné' },
];

const mediaTypeOptions = [
  { value: MediaType.CERTIFICATE, label: 'Certifikáty' },
  { value: MediaType.SALON_PHOTO, label: 'Prostory' },
  { value: MediaType.PORTRAIT_HOME, label: 'Portrét: Homepage' },
  { value: MediaType.PORTRAIT_ABOUT, label: 'Portrét: O mně' },
  { value: MediaType.PORTRAIT, label: 'Portrét: Legacy (obě stránky)' },
  { value: MediaType.GENERAL, label: 'Obecné' },
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
        message: 'Nepodporovaný typ souboru. Použijte JPG, PNG nebo WebP.',
      };
    case 'media-upload-failed':
      return { tone: 'error' as const, message: 'Nahrání selhalo. Zkuste to prosím znovu.' };
    default:
      return null;
  }
}

type MediaAssetItem = Awaited<ReturnType<typeof listMedia>>[number];

function buildFilterCounts(assets: MediaAssetItem[]) {
  return {
    ALL: assets.length,
    [MediaType.CERTIFICATE]: assets.filter((asset) => asset.type === MediaType.CERTIFICATE).length,
    [MediaType.SALON_PHOTO]: assets.filter((asset) => asset.type === MediaType.SALON_PHOTO).length,
    [MediaType.PORTRAIT]: assets.filter((asset) => asset.type === MediaType.PORTRAIT).length,
    [MediaType.PORTRAIT_HOME]: assets.filter((asset) => asset.type === MediaType.PORTRAIT_HOME).length,
    [MediaType.PORTRAIT_ABOUT]: assets.filter((asset) => asset.type === MediaType.PORTRAIT_ABOUT).length,
    [MediaType.GENERAL]: assets.filter((asset) => asset.type === MediaType.GENERAL).length,
  } satisfies Record<FilterTabValue, number>;
}

function getEmptyStateCopy(activeFilter: FilterTabValue) {
  switch (activeFilter) {
    case MediaType.CERTIFICATE:
      return {
        title: 'Zatím nejsou nahrané žádné certifikáty',
        description: 'Nahrajte další obrázek a hned nastavte titulek, alt text i publikaci.',
        cta: 'Nahrát obrázek',
      };
    case MediaType.SALON_PHOTO:
      return {
        title: 'Zatím nejsou nahrané žádné fotky prostor',
        description: 'Přidejte fotografie studia, které se pak propíšou do veřejných galerií.',
        cta: 'Nahrát obrázek',
      };
    case MediaType.PORTRAIT:
      return {
        title: 'Zatím nejsou nahrané žádné legacy portréty',
        description: 'Legacy portrét se používá jako fallback pro homepage i stránku O mně.',
        cta: 'Nahrát obrázek',
      };
    case MediaType.PORTRAIT_HOME:
      return {
        title: 'Zatím není nahraný portrét pro homepage',
        description: 'Nahrajte portrét, který se zobrazí pouze v hero na homepage.',
        cta: 'Nahrát obrázek',
      };
    case MediaType.PORTRAIT_ABOUT:
      return {
        title: 'Zatím není nahraný portrét pro stránku O mně',
        description: 'Nahrajte portrét, který se zobrazí pouze v hero sekci O mně.',
        cta: 'Nahrát obrázek',
      };
    case MediaType.GENERAL:
      return {
        title: 'Zatím nejsou nahrané žádné obecné obrázky',
        description: 'Sem patří univerzální vizuály připravené pro další obsahové bloky.',
        cta: 'Nahrát obrázek',
      };
    default:
      return {
        title: 'Zatím nejsou nahrané žádné obrázky',
        description: 'Začněte prvním uploadem a knihovna se tady okamžitě naplní.',
        cta: 'Nahrát první obrázek',
      };
  }
}

function mediaBadgeClass(type: MediaType) {
  switch (type) {
    case MediaType.CERTIFICATE:
      return 'border-[var(--color-accent)]/30 bg-[rgba(190,160,120,0.12)] text-[var(--color-accent-soft)]';
    case MediaType.SALON_PHOTO:
      return 'border-cyan-300/20 bg-cyan-400/10 text-cyan-50';
    case MediaType.PORTRAIT:
      return 'border-fuchsia-300/20 bg-fuchsia-400/10 text-fuchsia-50';
    case MediaType.PORTRAIT_HOME:
      return 'border-violet-300/20 bg-violet-400/10 text-violet-50';
    case MediaType.PORTRAIT_ABOUT:
      return 'border-indigo-300/20 bg-indigo-400/10 text-indigo-50';
    case MediaType.GENERAL:
      return 'border-white/12 bg-white/7 text-white/76';
  }
}

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
  const allAssets = await listMedia();
  const assets = activeFilter === 'ALL' ? allAssets : allAssets.filter((asset) => asset.type === activeFilter);
  const notification = flashMessage(flash);
  const counts = buildFilterCounts(allAssets);
  const publishedCount = allAssets.filter((asset) => asset.isPublished).length;
  const hiddenCount = allAssets.length - publishedCount;

  return (
    <AdminPageShell
      eyebrow={area === 'owner' ? 'Média webu' : 'Provozní média'}
      title="Média webu"
      description="Rychlá správa obrázků pro web. Certifikáty jsou jen jeden z typů médií, které tu můžete nahrát a spravovat."
      stats={[
        { label: 'Celkem médií', value: String(allAssets.length), tone: 'default' },
        { label: 'Publikováno', value: String(publishedCount), tone: 'accent' },
        { label: 'Skryto', value: String(hiddenCount), tone: 'muted' },
        { label: 'Certifikáty', value: String(counts[MediaType.CERTIFICATE]), tone: 'default' },
      ]}
      compactStats
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] xl:items-start">
        <MediaUploadForm area={area} activeFilter={activeFilter} />
        <AdminPanel
          title="Knihovna obrázků"
          description="Filtrujte podle typu, rychle měňte publikaci a hned vidíte, kde se obrázek na webu používá."
          compact={area === 'salon'}
          denseHeader
        >
          <MediaFilterTabs area={area} activeFilter={activeFilter} counts={counts} />
          <MediaGrid area={area} assets={assets} activeFilter={activeFilter} />
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}

export function MediaUploadForm({ area, activeFilter }: { area: AdminArea; activeFilter: FilterTabValue }) {
  return (
    <AdminPanel
      title="Nahrát obrázek"
      description="Kompaktní upload pro rychlé doplnění typu, titulku a alt textu."
      compact={area === 'salon'}
      denseHeader
    >
      <form id="media-upload-form" action={uploadMediaAction} className="space-y-4">
        <input type="hidden" name="area" value={area} />
        <input type="hidden" name="redirectFilter" value={activeFilter} />

        <MediaUploadDropzone name="file" accept="image/jpeg,image/png,image/webp" />

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Typ média</span>
            <select
              name="type"
              defaultValue={MediaType.CERTIFICATE}
              className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
            >
              {mediaTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Titulek</span>
            <input
              type="text"
              name="title"
              maxLength={120}
              className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
              placeholder="Např. Lash Lifting Masterclass"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Alt text</span>
          <input
            type="text"
            name="altText"
            maxLength={160}
            className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
            placeholder="Krátký popis obrázku"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.1rem] border border-white/8 bg-white/[0.03] px-4 py-3">
          <p className="text-sm text-white/62">Výchozí publikace je zapnutá, po nahrání ji můžete jedním klikem skrýt.</p>
          <button
            type="submit"
            className="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
          >
            Nahrát obrázek
          </button>
        </div>
      </form>
    </AdminPanel>
  );
}

export function MediaFilterTabs({
  area,
  activeFilter,
  counts,
}: {
  area: AdminArea;
  activeFilter: FilterTabValue;
  counts: Record<FilterTabValue, number>;
}) {
  const basePath = getMediaAdminPath(area);

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {filterTabs.map((tab) => {
        const href = tab.value === 'ALL' ? basePath : `${basePath}?type=${tab.value}`;
        const active = activeFilter === tab.value;

        return (
          <Link
            key={tab.value}
            href={href}
            className={
              active
                ? 'inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/45 bg-[rgba(190,160,120,0.16)] px-3.5 py-2 text-sm font-semibold text-white shadow-[0_8px_25px_rgba(0,0,0,0.16)]'
                : 'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-white/72 transition hover:border-white/16 hover:bg-white/10 hover:text-white'
            }
          >
            <span>{tab.label}</span>
            <span className={active ? 'text-[var(--color-accent-soft)]' : 'text-white/50'}>({counts[tab.value]})</span>
          </Link>
        );
      })}
    </div>
  );
}

export function MediaGrid({
  area,
  assets,
  activeFilter,
}: {
  area: AdminArea;
  assets: MediaAssetItem[];
  activeFilter: FilterTabValue;
}) {
  if (assets.length === 0) {
    const emptyState = getEmptyStateCopy(activeFilter);

    return (
      <div className="rounded-[1.35rem] border border-dashed border-white/14 bg-white/4 p-5">
        <p className="text-base font-medium text-white">{emptyState.title}</p>
        <p className="mt-2 text-sm leading-6 text-white/62">{emptyState.description}</p>
        <a
          href="#media-upload-form"
          className="mt-4 inline-flex rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/12"
        >
          {emptyState.cta}
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {assets.map((asset) => (
        <MediaCard key={asset.id} area={area} asset={asset} activeFilter={activeFilter} />
      ))}
    </div>
  );
}

export function MediaCard({
  area,
  asset,
  activeFilter,
}: {
  area: AdminArea;
  asset: MediaAssetItem;
  activeFilter: FilterTabValue;
}) {
  const preview = (
    <div className="group relative h-44 overflow-hidden border-b border-white/10 bg-black/20">
      {asset.thumbnailPublicUrl ? (
        <>
          <Image
            src={asset.thumbnailPublicUrl}
            alt={asset.altText ?? asset.title ?? asset.fileName}
            width={asset.thumbnailWidth ?? asset.optimizedWidth ?? asset.width ?? 400}
            height={asset.thumbnailHeight ?? asset.optimizedHeight ?? asset.height ?? 300}
            loading="eager"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            sizes="(min-width: 1536px) 20vw, (min-width: 768px) 35vw, 90vw"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3 text-xs font-medium text-white/74">
            Otevřít náhled
          </div>
        </>
      ) : (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-white/45">
          Obrázek je skrytý, proto se veřejný náhled nezobrazuje.
        </div>
      )}
    </div>
  );

  return (
    <article className="overflow-hidden rounded-[1.35rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.025))] shadow-[0_18px_45px_rgba(0,0,0,0.14)]">
      {asset.originalPublicUrl ? (
        <a href={asset.originalPublicUrl} target="_blank" rel="noreferrer" className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60">
          {preview}
        </a>
      ) : (
        preview
      )}

      <div className="space-y-4 p-4">
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="truncate text-base font-semibold text-white">{asset.title ?? asset.fileName}</h4>
              {asset.title ? <p className="mt-1 truncate text-xs text-white/50">{asset.fileName}</p> : null}
            </div>
            <span
              className={
                asset.isPublished
                  ? 'shrink-0 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-50'
                  : 'shrink-0 rounded-full border border-white/12 bg-white/8 px-2.5 py-1 text-[11px] font-semibold text-white/70'
              }
            >
              {asset.isPublished ? 'Publikováno' : 'Skryto'}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${mediaBadgeClass(asset.type)}`}>
              {getMediaTypeLabel(asset.type)}
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-medium text-white/62">
              {asset.width && asset.height ? `${asset.width} x ${asset.height}` : 'Rozměry neznámé'}
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-medium text-white/62">
              {formatBytes(asset.size)}
            </span>
          </div>
        </div>

        <div className="space-y-2 rounded-[1.05rem] border border-white/8 bg-black/15 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/48">Použití</p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--color-accent)]/30 bg-[rgba(190,160,120,0.1)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-accent-soft)]">
              {getMediaUsageLabel(asset.type)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] font-medium text-white/68">
              {getMediaUsageSectionLabel(asset.type)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <MediaEditDialog area={area} asset={asset} activeFilter={activeFilter} />
          <form action={updateMediaAction}>
            <input type="hidden" name="area" value={area} />
            <input type="hidden" name="assetId" value={asset.id} />
            <input type="hidden" name="type" value={asset.type} />
            <input type="hidden" name="title" value={asset.title ?? ''} />
            <input type="hidden" name="altText" value={asset.altText ?? ''} />
            <input type="hidden" name="redirectFilter" value={activeFilter} />
            <input type="hidden" name="isPublished" value={asset.isPublished ? 'false' : 'true'} />
            <button
              type="submit"
              className={
                asset.isPublished
                  ? 'rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/12'
                  : 'rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-50 transition hover:bg-emerald-400/15'
              }
            >
              {asset.isPublished ? 'Skrýt' : 'Publikovat'}
            </button>
          </form>
          <form action={deleteMediaAction}>
            <input type="hidden" name="area" value={area} />
            <input type="hidden" name="assetId" value={asset.id} />
            <input type="hidden" name="redirectFilter" value={activeFilter} />
            <button
              type="submit"
              className="rounded-full border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-white/58 transition hover:border-red-300/20 hover:bg-red-400/8 hover:text-red-50"
            >
              Odstranit
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}

export function MediaEditDialog({
  area,
  asset,
  activeFilter,
}: {
  area: AdminArea;
  asset: MediaAssetItem;
  activeFilter: FilterTabValue;
}) {
  return (
    <details className="group relative">
      <summary className="list-none rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/12 [&::-webkit-details-marker]:hidden">
        Upravit
      </summary>
      <div className="mt-2 w-full rounded-[1.1rem] border border-white/12 bg-[#15100d] p-4 shadow-[0_16px_45px_rgba(0,0,0,0.35)]">
        <div className="mb-3 border-b border-white/10 pb-3">
          <p className="text-sm font-semibold text-white">Upravit médium</p>
          <p className="mt-1 text-xs text-white/52">Změňte typ, texty nebo publikaci bez technických detailů.</p>
        </div>

        <form action={updateMediaAction} className="space-y-3">
          <input type="hidden" name="area" value={area} />
          <input type="hidden" name="assetId" value={asset.id} />
          <input type="hidden" name="redirectFilter" value={activeFilter} />

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">Typ média</span>
            <select
              name="type"
              defaultValue={asset.type}
              className="mt-1.5 w-full rounded-[0.95rem] border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--color-accent)]/60"
            >
              {mediaTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">Titulek</span>
            <input
              type="text"
              name="title"
              defaultValue={asset.title ?? ''}
              maxLength={120}
              className="mt-1.5 w-full rounded-[0.95rem] border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
              placeholder="Např. Lash Lifting Masterclass"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">Alt text</span>
            <input
              type="text"
              name="altText"
              defaultValue={asset.altText ?? ''}
              maxLength={160}
              className="mt-1.5 w-full rounded-[0.95rem] border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
              placeholder="Krátký popis obrázku"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">Publikace</span>
            <select
              name="isPublished"
              defaultValue={asset.isPublished ? 'true' : 'false'}
              className="mt-1.5 w-full rounded-[0.95rem] border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--color-accent)]/60"
            >
              <option value="true">Publikováno</option>
              <option value="false">Skryto</option>
            </select>
          </label>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
            >
              Uložit změny
            </button>
          </div>
        </form>
      </div>
    </details>
  );
}
