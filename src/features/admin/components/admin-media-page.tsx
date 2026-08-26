import Link from 'next/link';
import { MediaCollectionType } from '@/generated/prisma/browser';
import type { Prisma } from '@/generated/prisma/client';
import { type AdminArea } from '@/config/navigation';
import { AdminPageShell, AdminPanel } from '@/features/admin/components/admin-page-shell';
import { MediaAssetDetailDialog } from '@/features/admin/components/media-asset-detail-dialog';
import { MediaUploadDialog } from '@/features/admin/components/media-upload-dialog';
import { ReferenceMediaSection, type ReferenceMediaItem } from '@/features/admin/components/reference-media-section';
import { getAdminMediaPreviewUrl, getMediaAdminPath } from '@/features/admin/lib/admin-media-validation';
import { getMediaAssetUsage, getMediaAssetUsageBatch } from '@/features/media/lib/media-asset-usage';
import { listMedia, listMediaPage, listPublishedMedia } from '@/features/media/lib/media-library';
import { prisma } from '@/lib/prisma';
import { mediaUploadPolicy } from '@/lib/media/media-config';

type Asset = Awaited<ReturnType<typeof listMedia>>[number] & { adminPreviewUrl: string | null };
type Membership = { type: MediaCollectionType; sortOrder: number; isVisible: boolean };
const collections = [{ type: MediaCollectionType.STUDIO_GALLERY, label: 'Studio' }, { type: MediaCollectionType.CERTIFICATES, label: 'Certifikáty' }, { type: MediaCollectionType.REFERENCES, label: 'Reference' }] as const;
function flashMessage(flash?: string) { return ({ 'media-upload-success': 'Médium bylo nahrané.', 'media-replace-success': 'Soubor byl bezpečně nahrazen při zachování vazeb.', 'media-delete-success': 'Médium bylo odstraněné.', 'media-delete-in-use': 'Toto médium nelze smazat, protože je stále používané. Nejprve odeberte uvedené vazby.', 'media-membership-success': 'Členství v kolekci bylo uložené.', 'media-update-success': 'Metadata média byla uložená.', 'media-upload-missing-file': 'Vyberte prosím obrázek.', 'media-upload-empty-file': 'Vybraný soubor je prázdný.', 'media-upload-invalid-type': 'Použijte JPG, PNG nebo WebP.', 'media-upload-too-large': 'Soubor je příliš velký. Limit je 8 MB.', 'media-upload-failed': 'Médium se nepodařilo zpracovat. Zkuste to prosím znovu.', 'media-replace-invalid-payload': 'Soubor se nepodařilo nahradit. Vyberte prosím platný obrázek.' } as Record<string, string>)[flash ?? '']; }

export async function AdminMediaPage({ area, searchParams }: { area: AdminArea; searchParams?: Record<string, string | string[] | undefined> }) {
  const raw = (name: string) => typeof searchParams?.[name] === 'string' ? searchParams[name] as string : undefined;
  const search = raw('q')?.trim().toLocaleLowerCase('cs-CZ') ?? '';
  const usageFilter = raw('usage') === 'USED' || raw('usage') === 'UNUSED' ? raw('usage') : 'ALL';
  const publicationFilter = raw('publication') === 'PUBLISHED' || raw('publication') === 'HIDDEN' ? raw('publication') : 'ALL';
  const category = collections.some(({ type }) => type === raw('collection')) ? raw('collection') as MediaCollectionType : undefined;
  const requestedPage = Number.parseInt(raw('page') ?? '1', 10);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const usageWhere: Prisma.MediaAssetWhereInput = { OR: [
    { voucherPdfLogoSettings: { some: {} } }, { contactPhotoSettings: { some: {} } }, { homePortraitSettings: { some: {} } }, { aboutPortraitSettings: { some: {} } },
    { collectionItems: { some: {} } }, { serviceMedia: { some: {} } },
  ] };
  const where: Prisma.MediaAssetWhereInput = {
    deletionRequestedAt: null,
    ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { fileName: { contains: search, mode: 'insensitive' } }, { originalFilename: { contains: search, mode: 'insensitive' } }, { altText: { contains: search, mode: 'insensitive' } }] } : {}),
    ...(usageFilter === 'USED' ? usageWhere : usageFilter === 'UNUSED' ? { NOT: usageWhere } : {}),
    ...(publicationFilter === 'PUBLISHED' ? { isPublished: true } : publicationFilter === 'HIDDEN' ? { isPublished: false } : {}),
    ...(category ? { collectionItems: { some: { collection: { type: category } } } } : {}),
  };
  const [mediaPage, publicationGroups, referenceRows, publishedAssets] = await Promise.all([listMediaPage({ page, where }), prisma.mediaAsset.groupBy({ by: ['isPublished'], where: { deletionRequestedAt: null }, _count: { _all: true } }), prisma.mediaCollectionItem.findMany({ where: { collection: { type: MediaCollectionType.REFERENCES } }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: { id: true, mediaAssetId: true, sortOrder: true, isVisible: true, altText: true, caption: true, mediaAsset: { select: { id: true, title: true, fileName: true, altText: true, isPublished: true, optimizedUrl: true, thumbnailUrl: true, url: true } } } }), category === MediaCollectionType.REFERENCES ? listPublishedMedia() : Promise.resolve([])]);
  const { assets, pageCount } = mediaPage;
  const displayAssets: Asset[] = assets.map((asset) => ({ ...asset, adminPreviewUrl: asset.isPublished ? null : getAdminMediaPreviewUrl(area, asset.id) }));
  const referenceItems = referenceRows.map((item): ReferenceMediaItem | null => {
    const asset = item.mediaAsset;
    return asset ? { ...item, mediaAsset: { id: asset.id, title: asset.title, fileName: asset.fileName, altText: asset.altText, thumbnailPublicUrl: asset.isPublished ? asset.thumbnailUrl ?? asset.optimizedUrl ?? asset.url : null, publicUrl: asset.isPublished ? asset.optimizedUrl ?? asset.url : null } } : null;
  }).filter((item): item is ReferenceMediaItem => item !== null);
  const referencePickerAssets = publishedAssets.filter((asset) => !referenceItems.some((item) => item.mediaAssetId === asset.id));
  const rows = await prisma.mediaCollectionItem.findMany({ where: { mediaAssetId: { in: displayAssets.map((asset) => asset.id) } }, select: { mediaAssetId: true, sortOrder: true, isVisible: true, collection: { select: { type: true } } } });
  const memberships = new Map<string, Membership[]>();
  rows.forEach((row) => memberships.set(row.mediaAssetId, [...(memberships.get(row.mediaAssetId) ?? []), { type: row.collection.type, sortOrder: row.sortOrder, isVisible: row.isVisible }]));
  const usages = await getMediaAssetUsageBatch(displayAssets.map((asset) => asset.id));
  const base = getMediaAdminPath(area);
  const publicationStats = new Map(publicationGroups.map((group) => [group.isPublished, group._count._all]));
  const href = (next: Record<string, string | undefined>) => { const query = new URLSearchParams(); Object.entries({ q: search || undefined, usage: usageFilter === 'ALL' ? undefined : usageFilter, publication: publicationFilter === 'ALL' ? undefined : publicationFilter, collection: category, ...next }).forEach(([key, value]) => value && query.set(key, value)); return `${base}${query.size ? `?${query}` : ''}`; };
  const displayPage = mediaPage.page;
  const returnTo = href({ page: displayPage > 1 ? String(displayPage) : undefined });
  return <AdminPageShell eyebrow="Obsah webu" title="Média" description="Centrální knihovna souborů a jejich skutečných použití." stats={[{ label: 'Celkem', value: String((publicationStats.get(true) ?? 0) + (publicationStats.get(false) ?? 0)), tone: 'default' }, { label: 'Publikováno', value: String(publicationStats.get(true) ?? 0), tone: 'accent' }, { label: 'Skryto', value: String(publicationStats.get(false) ?? 0), tone: 'muted' }]} compactStats compact={area === 'salon'}>
    {flashMessage(raw('flash')) ? <p role="status" aria-live="polite" className="rounded-[1.25rem] border border-[var(--color-accent)]/30 bg-[rgba(190,160,120,0.1)] px-4 py-3 text-sm text-[var(--color-accent-soft)]">{flashMessage(raw('flash'))}</p> : null}
    <AdminPanel title="Knihovna médií" description="Vyhledávejte soubory, spravujte kolekce a bezpečně nahrazujte assety." compact={area === 'salon'} denseHeader>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center"><form action={base} className="flex min-w-0 flex-1 gap-2"><label className="sr-only" htmlFor="media-search">Hledat média</label><input id="media-search" name="q" defaultValue={search} placeholder="Hledat název, soubor nebo alt text" className="min-h-11 min-w-0 flex-1 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-[var(--color-accent)]/60"/><input type="hidden" name="usage" value={usageFilter === 'ALL' ? '' : usageFilter}/><input type="hidden" name="publication" value={publicationFilter === 'ALL' ? '' : publicationFilter}/><input type="hidden" name="collection" value={category ?? ''}/><button className="min-h-11 shrink-0 rounded-full border border-white/12 px-4 py-2 text-sm text-white transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]">Hledat</button></form><MediaUploadDialog area={area} returnTo={returnTo} accept={[...mediaUploadPolicy.allowedMimeTypes.keys()].join(',')} supportedTypes={[...mediaUploadPolicy.allowedMimeTypes.values()].flat().map((extension) => extension.toUpperCase()).join(', ')} maxFileSizeMb={mediaUploadPolicy.maxFileSizeBytes / (1024 * 1024)}/></div>
      <nav aria-label="Filtry médií" className="mb-5 flex flex-col gap-2.5 rounded-[1.15rem] border border-white/8 bg-black/10 p-2.5 sm:flex-row sm:flex-wrap sm:items-center"> <div className="flex flex-wrap gap-2">{([{ value: 'ALL', label: 'Vše' }, { value: 'USED', label: 'Použitá' }, { value: 'UNUSED', label: 'Nepoužitá' }] as const).map((filter) => <Link key={filter.value} href={href({ usage: filter.value === 'ALL' ? undefined : filter.value })} className={`min-h-10 rounded-full border px-3.5 py-2 text-sm transition-colors ${usageFilter === filter.value ? 'border-[var(--color-accent)]/45 bg-[rgba(190,160,120,0.16)] text-white' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'}`}>{filter.label}</Link>)}</div><span className="hidden h-6 border-l border-white/10 sm:block"/><div className="flex flex-wrap gap-2">{([{ value: 'ALL', label: 'Vše' }, { value: 'PUBLISHED', label: 'Publikováno' }, { value: 'HIDDEN', label: 'Skryto' }] as const).map((filter) => <Link key={filter.value} href={href({ publication: filter.value === 'ALL' ? undefined : filter.value })} className={`min-h-10 rounded-full border px-3.5 py-2 text-sm transition-colors ${publicationFilter === filter.value ? 'border-[var(--color-accent)]/45 bg-[rgba(190,160,120,0.16)] text-white' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'}`}>{filter.label}</Link>)}</div><span className="hidden h-6 border-l border-white/10 sm:block"/><div className="flex flex-wrap gap-2">{collections.map((collection) => <Link key={collection.type} href={href({ collection: category === collection.type ? undefined : collection.type })} className={`min-h-10 rounded-full border px-3.5 py-2 text-sm transition-colors ${category === collection.type ? 'border-[var(--color-accent)]/45 bg-[rgba(190,160,120,0.16)] text-white' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'}`}>{collection.label}</Link>)}</div></nav>
      {category === MediaCollectionType.REFERENCES ? <ReferenceMediaSection area={area} assets={referencePickerAssets} items={referenceItems}/> : null}
      {category !== MediaCollectionType.REFERENCES && (displayAssets.length ? <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{displayAssets.map((asset) => <MediaCard key={asset.id} area={area} asset={asset} usage={usages.get(asset.id)!} memberships={memberships.get(asset.id) ?? []} returnTo={returnTo}/>)}</div>{pageCount > 1 ? <nav aria-label="Stránkování médií" className="mt-5 flex items-center justify-between gap-3 text-sm"><Link href={href({ page: displayPage > 1 ? String(displayPage - 1) : undefined })} aria-disabled={displayPage <= 1} className={`rounded-full border px-4 py-2 ${displayPage <= 1 ? 'pointer-events-none opacity-40' : 'border-white/15 text-white'}`}>Předchozí</Link><span className="text-white/60">Strana {displayPage} z {pageCount}</span><Link href={href({ page: displayPage < pageCount ? String(displayPage + 1) : undefined })} aria-disabled={displayPage >= pageCount} className={`rounded-full border px-4 py-2 ${displayPage >= pageCount ? 'pointer-events-none opacity-40' : 'border-white/15 text-white'}`}>Další</Link></nav> : null}</> : <p className="rounded-[1.35rem] border border-dashed border-white/14 p-6 text-sm text-white/62">Pro tento filtr zatím nejsou žádná média.</p>)}
    </AdminPanel>
  </AdminPageShell>;
}

function MediaCard({ area, asset, usage, memberships, returnTo }: { area: AdminArea; asset: Asset; usage: Awaited<ReturnType<typeof getMediaAssetUsage>>; memberships: Membership[]; returnTo: string }) { return <MediaAssetDetailDialog area={area} asset={asset} usage={usage} memberships={memberships} returnTo={returnTo}/>; }
