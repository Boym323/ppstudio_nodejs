import Image from 'next/image';
import Link from 'next/link';
import type { AdminArea } from '@/config/navigation';
import { prisma } from '@/lib/prisma';
import { getAdminMediaPreviewUrl, getMediaAdminPath } from '../lib/admin-media-validation';

/* eslint-disable @next/next/no-img-element -- Privátní náhled potřebuje cookie přihlášeného prohlížeče. */

export async function MediaPlacementOverview({ area }: { area: AdminArea }) {
  const mediaSelect = { id: true, title: true, fileName: true, isPublished: true, visibility: true, deletionRequestedAt: true, thumbnailUrl: true, optimizedUrl: true, url: true } as const;
  const [settings, collectionCounts, serviceCount] = await Promise.all([
    prisma.siteSettings.findUnique({ where: { id: 'site-settings' }, select: { homePortraitMedia: { select: mediaSelect }, aboutPortraitMedia: { select: mediaSelect }, contactPhotoMedia: { select: mediaSelect } } }),
    prisma.mediaCollection.findMany({ select: { type: true, _count: { select: { items: true } } } }),
    prisma.service.count(),
  ]);
  const base = getMediaAdminPath(area);
  const portraits = [
    { label: 'Úvodní stránka', field: 'homePortraitMediaId', asset: settings?.homePortraitMedia },
    { label: 'O mně', field: 'aboutPortraitMediaId', asset: settings?.aboutPortraitMedia },
    { label: 'Kontakt', field: 'contactPhotoMediaId', asset: settings?.contactPhotoMedia },
  ];
  const collections = [{ type: 'STUDIO_GALLERY', label: 'Studio' }, { type: 'CERTIFICATES', label: 'Certifikáty' }, { type: 'REFERENCES', label: 'Reference' }];
  return <div className="space-y-6">
    <p className="text-sm text-white/60">Vyberte místo, jehož fotografie chcete upravit. Soubor zůstává uložený v jedné společné knihovně.</p>
    <div className="grid gap-3 md:grid-cols-3">{portraits.map(({ label, field, asset }) => {
      const published = asset?.isPublished && asset.visibility === 'PUBLIC' && !asset.deletionRequestedAt;
      const preview = asset ? published ? asset.thumbnailUrl ?? asset.optimizedUrl ?? asset.url : getAdminMediaPreviewUrl(area, asset.id) : null;
      return <article key={field} className="rounded-xl border border-white/10 bg-white/[.035] p-4">
        <h2 className="font-semibold text-white">{label}</h2><div className="relative my-3 h-28 overflow-hidden rounded-lg bg-black/20">{preview ? published ? <Image src={preview} alt="" fill sizes="300px" className="object-contain"/> : <img src={preview} alt="" className="h-full w-full object-contain"/> : <span className="flex h-full items-center justify-center text-sm text-white/40">Bez fotografie</span>}</div>
        <p className="truncate text-sm text-white/70">{asset?.title ?? asset?.fileName ?? 'Fotografie není přiřazená'}</p><p className={`mt-1 text-xs ${published ? 'text-emerald-200' : 'text-amber-100'}`}>{published ? 'Přiřazeno · publikováno' : asset ? 'Přiřazeno · soubor není veřejně dostupný' : 'Chybí fotografie'}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">{area === 'owner' ? <Link href={`/admin/nastaveni#${field}`} className="inline-flex min-h-11 items-center text-[var(--color-accent-soft)] underline">Změnit fotografii</Link> : <span className="text-xs text-white/50">Přiřazení mění majitelka v Nastavení.</span>}{asset ? <Link href={`${base}?asset=${asset.id}`} className="inline-flex min-h-11 items-center text-white/65 underline">Upravit soubor</Link> : null}</div>
      </article>;
    })}</div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Link href={`${base}?collection=SERVICE_MEDIA`} className="rounded-xl border border-white/10 bg-white/[.035] p-5 hover:bg-white/5"><h2 className="font-semibold text-white">Služby</h2><p className="mt-2 text-sm text-white/60">{serviceCount} služeb · hlavní fotografie a galerie</p><p className="mt-4 text-sm text-[var(--color-accent-soft)]">Spravovat fotografie →</p></Link>
      {collections.map(({ type, label }) => <Link key={type} href={`${base}?collection=${type}`} className="rounded-xl border border-white/10 bg-white/[.035] p-5 hover:bg-white/5"><h2 className="font-semibold text-white">{label}</h2><p className="mt-2 text-sm text-white/60">{collectionCounts.find((item) => item.type === type)?._count.items ?? 0} přiřazených souborů</p><p className="mt-4 text-sm text-[var(--color-accent-soft)]">Spravovat kolekci →</p></Link>)}
    </div>
  </div>;
}
