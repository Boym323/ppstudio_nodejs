import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MediaCollectionType } from '@/generated/prisma/browser';
import type { Prisma } from '@/generated/prisma/client';
import type { AdminArea } from '@/config/navigation';
import { AdminPageShell, AdminPanel } from './admin-page-shell';
import { MediaAssetDetailDialog } from './media-asset-detail-dialog';
import { MediaUploadDialog } from './media-upload-dialog';
import { MediaCollectionSection, type MediaCollectionSectionItem } from './media-collection-section';
import { ReferenceMediaSection, type ReferenceMediaItem } from './reference-media-section';
import { ServiceMediaOverview, type ServiceMediaOverviewItem } from './service-media-overview';
import { MediaPlacementOverview } from './media-placement-overview';
import { MediaLibraryResults } from './media-library-results';
import { getAdminMediaPreviewUrl, getManagedCollectionCanonicalUrl, getMediaAdminPath } from '../lib/admin-media-validation';
import { mediaLocations } from '../lib/admin-media-presentation';
import { getMediaAssetUsageBatch } from '@/features/media/lib/media-asset-usage';
import { listMediaPage } from '@/features/media/lib/media-library';
import { prisma } from '@/lib/prisma';
import { mediaUploadPolicy } from '@/lib/media/media-config';

type Membership = { type: MediaCollectionType; sortOrder: number; isVisible: boolean; canMoveUp: boolean; canMoveDown: boolean };
const collections = [{ type: MediaCollectionType.STUDIO_GALLERY, label: 'Studio' }, { type: MediaCollectionType.CERTIFICATES, label: 'Certifikáty' }, { type: MediaCollectionType.REFERENCES, label: 'Reference' }] as const;
const controlClass = 'min-h-11 w-full rounded-lg border border-white/15 bg-[#211e24] px-3 py-2 text-sm text-white';
const linkClass = 'inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm text-white/75 hover:bg-white/5';
const locationWhere: Record<string, Prisma.MediaAssetWhereInput> = {
  HOME: { homePortraitSettings: { some: {} } },
  ABOUT: { aboutPortraitSettings: { some: {} } },
  CONTACT: { contactPhotoSettings: { some: {} } },
  SERVICES: { serviceMedia: { some: {} } },
  ...Object.fromEntries(collections.map(({ type }) => [type, { collectionItems: { some: { collection: { type } } } }])),
};

function flashMessage(flash: string | undefined, uploaded: number, failed: number, changed: number, skipped: number) {
  if (flash === 'media-upload-partial') return `Nahráno ${uploaded} souborů, ${failed} se nepodařilo zpracovat. Úspěšně nahrané soubory najdete níže; opakujte pouze chybějící.`;
  if (flash === 'media-upload-success') return `Nahráno ${uploaded} souborů. Níže vidíte právě nahrané soubory; doplňte názvy, publikaci a jejich umístění.`;
  if (flash === 'media-bulk-success') return `Změněno ${changed} souborů, přeskočeno ${skipped}. Přeskočené soubory již měly požadovaný stav, nebyly dostupné nebo je nelze smazat kvůli použití.`;
  return ({
    'media-upload-collection-success': `Nahráno a zařazeno do kolekce: ${uploaded} souborů.`,
    'media-upload-collection-draft': 'Soubory jsou uložené jako neveřejné a vidíte je níže. Pro přidání do kolekce je nejprve publikujte a potom v detailu zvolte Zařadit.',
    'media-replace-success': 'Soubor byl nahrazen, jeho použití zůstalo zachované.',
    'media-delete-success': 'Médium bylo odstraněné.',
    'media-delete-in-use': 'Médium nelze smazat, protože se stále používá. Nejprve odeberte jeho použití.',
    'media-membership-success': 'Zařazení do kolekce bylo uložené.',
    'media-membership-asset-not-public': 'Před přidáním do kolekce médium publikujte.',
    'media-update-success': 'Změny média byly uložené.',
    'media-upload-missing-file': 'Vyberte prosím obrázek.',
    'media-upload-empty-file': 'Vybraný soubor je prázdný.',
    'media-upload-invalid-type': 'Použijte JPG, PNG, WebP nebo HEIC/HEIF.',
    'media-upload-too-large': 'Soubor je příliš velký. Limit je 8 MB.',
    'media-upload-too-many': 'Vyberte nejvýše 8 souborů najednou.',
    'media-upload-failed': 'Médium se nepodařilo zpracovat. Zkuste to prosím znovu.',
    'media-upload-invalid-payload': 'Zkontrolujte názvy a popisy souborů. Název smí mít nejvýše 120 znaků, alt text 160.',
    'media-replace-invalid-payload': 'Soubor se nepodařilo nahradit. Vyberte platný obrázek.',
    'media-update-invalid-payload': 'Změny nebyly uložené. Zkontrolujte vyplněné údaje.',
    'media-membership-invalid-payload': 'Zařazení nebylo změněné. Obnovte stránku a zkuste to znovu.',
  } as Record<string, string>)[flash ?? ''];
}

export async function AdminMediaPage({ area, searchParams }: { area: AdminArea; searchParams?: Record<string, string | string[] | undefined> }) {
  const raw = (name: string) => typeof searchParams?.[name] === 'string' ? searchParams[name] as string : undefined;
  const count = (name: string) => Math.max(0, Math.min(9999, Number.parseInt(raw(name) ?? '0', 10) || 0));
  const canonicalUrl = getManagedCollectionCanonicalUrl(area, searchParams ?? {});
  if (canonicalUrl) redirect(canonicalUrl);
  const category = collections.find(({ type }) => type === raw('collection'))?.type;
  const serviceMediaView = raw('collection') === 'SERVICE_MEDIA';
  const placements = Boolean(category || serviceMediaView || raw('view') === 'placements');
  const library = !placements;
  const base = getMediaAdminPath(area);
  const search = raw('q')?.trim().slice(0, 160) ?? '';
  const usageFilter = raw('usage') === 'USED' || raw('usage') === 'UNUSED' ? raw('usage') : 'ALL';
  const publicationFilter = raw('publication') === 'PUBLISHED' || raw('publication') === 'HIDDEN' ? raw('publication') : 'ALL';
  const location = mediaLocations.find(({ value }) => value === raw('location'))?.value;
  const untitled = raw('untitled') === '1';
  const sort = raw('sort') === 'name' ? 'name' : raw('sort') === 'oldest' ? 'oldest' : raw('sort') === 'size' ? 'size' : 'newest';
  const layout = raw('layout') === 'grid' ? 'grid' : 'list';
  const requestedPage = Number.parseInt(raw('page') ?? '1', 10);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const newIds = (raw('new') ?? '').split(',').filter((id) => /^c[a-z0-9]{20,40}$/.test(id)).slice(0, 8);
  const assetId = /^c[a-z0-9]{20,40}$/.test(raw('asset') ?? '') ? raw('asset') : undefined;
  const usageWhere: Prisma.MediaAssetWhereInput = { OR: [
    { voucherPdfLogoSettings: { some: {} } }, { contactPhotoSettings: { some: {} } }, { homePortraitSettings: { some: {} } }, { aboutPortraitSettings: { some: {} } },
    { collectionItems: { some: {} } }, { serviceMedia: { some: {} } },
  ] };
  const textMatch = { contains: search, mode: 'insensitive' as const };
  const matchingLocations = search ? mediaLocations.filter(({ label }) => label.toLocaleLowerCase('cs-CZ').includes(search.toLocaleLowerCase('cs-CZ'))).map(({ value }) => locationWhere[value]) : [];
  const filterConditions: Prisma.MediaAssetWhereInput[] = [
    ...(search ? [{ OR: [{ title: textMatch }, { fileName: textMatch }, { originalFilename: textMatch }, { altText: textMatch }, { serviceMedia: { some: { service: { name: textMatch } } } }, ...matchingLocations] }] : []),
    ...(usageFilter === 'USED' ? [usageWhere] : usageFilter === 'UNUSED' ? [{ NOT: usageWhere }] : []),
    ...(location ? [locationWhere[location]] : []),
    ...(untitled ? [{ OR: [{ title: null }, { title: '' }] }] : []),
    ...(newIds.length ? [{ id: { in: newIds } }] : []),
    ...(assetId ? [{ id: assetId }] : []),
  ];
  const where: Prisma.MediaAssetWhereInput = {
    deletionRequestedAt: null,
    ...(filterConditions.length ? { AND: filterConditions } : {}),
    ...(publicationFilter === 'PUBLISHED' ? { isPublished: true } : publicationFilter === 'HIDDEN' ? { isPublished: false } : {}),
  };
  const collectionAssetSelect = { id: true, title: true, fileName: true, altText: true, isPublished: true, visibility: true, deletionRequestedAt: true, optimizedUrl: true, thumbnailUrl: true, url: true } as const;
  const [mediaPage, publicationGroups, collectionRows, serviceRows] = await Promise.all([
    library ? listMediaPage({ page, where, sort }) : Promise.resolve({ assets: [], total: 0, page: 1, pageSize: 48, pageCount: 1 }),
    prisma.mediaAsset.groupBy({ by: ['isPublished'], where: { deletionRequestedAt: null }, _count: { _all: true } }),
    category ? prisma.mediaCollectionItem.findMany({ where: { collection: { type: category } }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: { id: true, mediaAssetId: true, sortOrder: true, isVisible: true, altText: true, caption: true, mediaAsset: { select: collectionAssetSelect } } }) : Promise.resolve([]),
    serviceMediaView ? prisma.service.findMany({ orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true, slug: true, isActive: true, isPubliclyBookable: true, category: { select: { name: true } }, media: { orderBy: [{ role: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }], select: { role: true, altText: true, mediaAsset: { select: collectionAssetSelect } } } } }) : Promise.resolve([]),
  ]);
  const displayAssets = mediaPage.assets.map((asset) => ({ ...asset, adminPreviewUrl: !asset.isPublished || asset.visibility !== 'PUBLIC' ? getAdminMediaPreviewUrl(area, asset.id) : null }));
  const collectionItems = collectionRows.map((item): MediaCollectionSectionItem & ReferenceMediaItem => {
    const asset = item.mediaAsset;
    const published = asset.isPublished && asset.visibility === 'PUBLIC' && !asset.deletionRequestedAt;
    return { ...item, mediaAsset: { id: asset.id, title: asset.title, fileName: asset.fileName, altText: asset.altText, thumbnailPublicUrl: published ? asset.thumbnailUrl ?? asset.optimizedUrl ?? asset.url : null, publicUrl: published ? asset.optimizedUrl ?? asset.url : null, adminPreviewUrl: published ? null : getAdminMediaPreviewUrl(area, asset.id) } };
  });
  const rows = displayAssets.length ? await prisma.mediaCollectionItem.findMany({ where: { mediaAssetId: { in: displayAssets.map((asset) => asset.id) } }, select: { mediaAssetId: true, collectionId: true, sortOrder: true, isVisible: true, collection: { select: { type: true } } } }) : [];
  const collectionIds = [...new Set(rows.map((row) => row.collectionId))];
  const collectionBoundaries = collectionIds.length ? await prisma.mediaCollectionItem.groupBy({
    by: ['collectionId'],
    where: { collectionId: { in: collectionIds } },
    _min: { sortOrder: true },
    _max: { sortOrder: true },
  }) : [];
  const boundariesByCollection = new Map(collectionBoundaries.map((boundary) => [boundary.collectionId, boundary]));
  const memberships = new Map<string, Membership[]>();
  rows.forEach((row) => {
    const boundary = boundariesByCollection.get(row.collectionId);
    memberships.set(row.mediaAssetId, [...(memberships.get(row.mediaAssetId) ?? []), {
      type: row.collection.type,
      sortOrder: row.sortOrder,
      isVisible: row.isVisible,
      canMoveUp: row.sortOrder !== boundary?._min.sortOrder,
      canMoveDown: row.sortOrder !== boundary?._max.sortOrder,
    }]);
  });
  const usages = await getMediaAssetUsageBatch(displayAssets.map((asset) => asset.id));
  const publicationStats = new Map(publicationGroups.map((group) => [group.isPublished, group._count._all]));
  const href = (next: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    Object.entries({ q: search || undefined, usage: usageFilter === 'ALL' ? undefined : usageFilter, publication: publicationFilter === 'ALL' ? undefined : publicationFilter, location, untitled: untitled ? '1' : undefined, sort: sort === 'newest' ? undefined : sort, layout: layout === 'list' ? undefined : layout, new: newIds.length ? newIds.join(',') : undefined, asset: assetId, ...next }).forEach(([key, value]) => value && query.set(key, value));
    return `${base}${query.size ? `?${query}` : ''}`;
  };
  const returnTo = category ? `${base}?collection=${category}` : serviceMediaView ? `${base}?collection=SERVICE_MEDIA` : href({ page: mediaPage.page > 1 ? String(mediaPage.page) : undefined });
  const serviceItems: ServiceMediaOverviewItem[] = serviceRows.map((service) => {
    const visible = service.media.filter((item) => item.mediaAsset.isPublished && item.mediaAsset.visibility === 'PUBLIC' && !item.mediaAsset.deletionRequestedAt);
    const hero = visible.find((item) => item.role === 'HERO');
    return { id: service.id, name: service.name, slug: service.slug, category: service.category.name, isActive: service.isActive, isPubliclyBookable: service.isPubliclyBookable, hero: hero ? { url: hero.mediaAsset.optimizedUrl ?? hero.mediaAsset.url, alt: hero.altText ?? hero.mediaAsset.altText ?? hero.mediaAsset.title ?? service.name } : null, galleryCount: visible.filter((item) => item.role === 'GALLERY').length, publishedCount: visible.length, totalCount: service.media.length };
  });
  const flash = flashMessage(raw('flash'), count('uploaded'), count('failed'), count('changed'), count('skipped'));
  const upload = <MediaUploadDialog area={area} returnTo={returnTo} collectionType={category} accept={[...mediaUploadPolicy.allowedMimeTypes.keys()].join(',')} supportedTypes={[...mediaUploadPolicy.allowedMimeTypes.values()].flat().map((extension) => extension.toUpperCase()).join(', ')} maxFileSizeMb={mediaUploadPolicy.maxFileSizeBytes / (1024 * 1024)}/>;
  const activeFilters = Boolean(search || usageFilter !== 'ALL' || publicationFilter !== 'ALL' || location || untitled || newIds.length || assetId);

  return <AdminPageShell eyebrow="Obsah webu" title="Média" description="Najděte soubor podle názvu nebo upravte fotografie konkrétního místa na webu." stats={[{ label: 'Souborů celkem', value: String((publicationStats.get(true) ?? 0) + (publicationStats.get(false) ?? 0)), tone: 'default' }, { label: 'Publikováno', value: String(publicationStats.get(true) ?? 0), tone: 'accent' }, { label: 'Nepublikováno', value: String(publicationStats.get(false) ?? 0), tone: 'muted' }]} compactStats compact={area === 'salon'}>
    {flash ? <p role="status" aria-live="polite" className="rounded-xl border border-[var(--color-accent)]/30 bg-[rgba(190,160,120,0.1)] px-4 py-3 text-sm text-[var(--color-accent-soft)]">{flash}</p> : null}
    <nav aria-label="Správa médií" className="flex flex-wrap gap-2">{[{ label: 'Knihovna souborů', url: base, active: library }, { label: 'Umístění na webu', url: `${base}?view=placements`, active: placements }].map(({ label, url, active }) => <Link key={url} href={url} aria-current={active ? 'page' : undefined} className={`${linkClass} ${active ? 'bg-white/10 text-white' : ''}`}>{label}</Link>)}</nav>
    <AdminPanel title={library ? 'Knihovna souborů' : serviceMediaView ? 'Fotografie služeb' : collections.find(({ type }) => type === category)?.label ?? 'Umístění na webu'} description={library ? 'Publikace zpřístupní soubor. Jeho přiřazení a viditelnost určují, kde se může zobrazit.' : 'Správa fotografií podle jejich účelu.'} compact={area === 'salon'} denseHeader>
      {placements ? <>
        {category || serviceMediaView ? <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><Link href={`${base}?view=placements`} className={linkClass}>← Všechna umístění</Link>{category ? upload : null}</div> : null}
        {category && newIds.length ? <Link href={`${base}?new=${newIds.join(',')}`} className={`${linkClass} mb-4`}>Upravit právě nahrané soubory ({newIds.length})</Link> : null}
        {serviceMediaView ? <ServiceMediaOverview area={area} items={serviceItems}/> : category === 'REFERENCES' ? <ReferenceMediaSection area={area} items={collectionItems}/> : category ? <MediaCollectionSection area={area} collectionType={category} items={collectionItems} returnTo={returnTo}/> : <MediaPlacementOverview area={area}/>}
      </> : <>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{[{ label: 'Všechny soubory', url: base, active: !activeFilters }, { label: 'Bez použití', url: `${base}?usage=UNUSED`, active: usageFilter === 'UNUSED' }, { label: 'Nepublikované', url: `${base}?publication=HIDDEN`, active: publicationFilter === 'HIDDEN' }, { label: 'Bez názvu', url: `${base}?untitled=1`, active: untitled }].map(({ label, url, active }) => <Link key={url} href={url} aria-current={active ? 'page' : undefined} className={`${linkClass} ${active ? 'bg-white/10' : ''}`}>{label}</Link>)}</div>{upload}</div>
        <form action={base} className="mb-4 space-y-3 rounded-xl border border-white/10 bg-black/10 p-3">
          <div className="flex gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Hledat soubory a umístění</span><input name="q" defaultValue={search} maxLength={160} placeholder="Název, soubor, služba nebo umístění…" className={controlClass}/></label><button className={linkClass}>Hledat</button></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs text-white/60">Použití<select name="usage" defaultValue={usageFilter} className={`${controlClass} mt-1`}><option value="ALL">Všechna</option><option value="USED">Přiřazená</option><option value="UNUSED">Bez použití</option></select></label>
            <label className="text-xs text-white/60">Publikace<select name="publication" defaultValue={publicationFilter} className={`${controlClass} mt-1`}><option value="ALL">Všechny stavy</option><option value="PUBLISHED">Publikováno</option><option value="HIDDEN">Nepublikováno</option></select></label>
            <label className="text-xs text-white/60">Umístění<select name="location" defaultValue={location ?? ''} className={`${controlClass} mt-1`}><option value="">Všechna umístění</option>{mediaLocations.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-xs text-white/60">Řazení<select name="sort" defaultValue={sort} className={`${controlClass} mt-1`}><option value="newest">Nejnovější</option><option value="oldest">Nejstarší</option><option value="name">Podle názvu</option><option value="size">Největší soubory</option></select></label>
          </div>
          <div className="flex flex-wrap items-center gap-3"><label className="flex min-h-11 items-center gap-2 text-sm text-white/65"><input type="checkbox" name="untitled" value="1" defaultChecked={untitled}/> Jen bez názvu</label><button className={linkClass}>Použít filtry</button>{activeFilters ? <Link href={base} className="text-sm text-[var(--color-accent-soft)] underline">Zrušit filtry</Link> : null}</div>
          <input type="hidden" name="layout" value={layout}/>{newIds.length ? <input type="hidden" name="new" value={newIds.join(',')}/> : null}{assetId ? <input type="hidden" name="asset" value={assetId}/> : null}
        </form>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><p aria-live="polite" className="text-sm text-white/60">{mediaPage.total ? `${(mediaPage.page - 1) * mediaPage.pageSize + 1}–${Math.min(mediaPage.page * mediaPage.pageSize, mediaPage.total)} z ${mediaPage.total} souborů` : '0 souborů'}{newIds.length ? ' · právě nahrané' : assetId ? ' · vybraný soubor' : ''}</p><nav aria-label="Zobrazení knihovny" className="flex gap-2"><Link href={href({ layout: undefined, page: String(mediaPage.page) })} aria-current={layout === 'list' ? 'page' : undefined} className={`${linkClass} ${layout === 'list' ? 'bg-white/10' : ''}`}>Seznam</Link><Link href={href({ layout: 'grid', page: String(mediaPage.page) })} aria-current={layout === 'grid' ? 'page' : undefined} className={`${linkClass} ${layout === 'grid' ? 'bg-white/10' : ''}`}>Mřížka</Link></nav></div>
        {displayAssets.length ? <MediaLibraryResults key={returnTo} area={area} layout={layout} returnTo={returnTo} items={displayAssets.map((asset) => ({ id: asset.id, title: asset.title || asset.originalFilename || asset.fileName, isUsed: usages.get(asset.id)!.isUsed, content: <MediaAssetDetailDialog area={area} asset={asset} usage={usages.get(asset.id)!} memberships={memberships.get(asset.id) ?? []} returnTo={returnTo} layout={layout}/> }))}/> : <div className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-white/60"><p>Žádný soubor neodpovídá zvolenému pohledu.</p><Link href={base} className="mt-3 inline-flex min-h-11 items-center text-[var(--color-accent-soft)] underline">Zobrazit celou knihovnu</Link></div>}
        {mediaPage.pageCount > 1 ? <nav aria-label="Stránkování médií" className="mt-5 flex items-center justify-between gap-3 text-sm"><PaginationControl href={href({ page: String(mediaPage.page - 1) })} disabled={mediaPage.page <= 1}>Předchozí</PaginationControl><span className="text-white/60">Strana {mediaPage.page} z {mediaPage.pageCount}</span><PaginationControl href={href({ page: String(mediaPage.page + 1) })} disabled={mediaPage.page >= mediaPage.pageCount}>Další</PaginationControl></nav> : null}
      </>}
    </AdminPanel>
  </AdminPageShell>;
}

function PaginationControl({ href, disabled, children }: { href: string; disabled: boolean; children: string }) {
  return disabled ? <span aria-disabled="true" className={`${linkClass} opacity-40`}>{children}</span> : <Link href={href} className={linkClass}>{children}</Link>;
}
