import { MediaCollectionType, ServiceMediaRole, type Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { publicMediaAssetWhere } from "./public-media-asset";

export const MEDIA_PICKER_PAGE_SIZE = 24;
export type MediaPickerScope =
  | { type: "GENERAL"; section: "SETTINGS" | "SERVICES" }
  | { type: "COLLECTION"; collectionType: "STUDIO_GALLERY" | "CERTIFICATES" }
  | { type: "REFERENCES" }
  | { type: "SERVICE_GALLERY"; serviceId: string };
export type MediaPickerAssetSummary = { id: string; title: string | null; fileName: string; altText: string | null; thumbnailPublicUrl: string | null; publicUrl: string | null };

function scopeWhere(scope: MediaPickerScope): Prisma.MediaAssetWhereInput {
  switch (scope.type) {
    case "COLLECTION": return { collectionItems: { none: { collection: { type: scope.collectionType } } } };
    case "REFERENCES": return { collectionItems: { none: { collection: { type: MediaCollectionType.REFERENCES } } } };
    case "SERVICE_GALLERY": return { serviceMedia: { none: { serviceId: scope.serviceId, role: ServiceMediaRole.GALLERY } } };
    case "GENERAL": return {};
  }
}

export async function searchMediaPickerAssets({ search = "", page = 1, pageSize = MEDIA_PICKER_PAGE_SIZE, scope }: { search?: string; page?: number; pageSize?: number; scope: MediaPickerScope }) {
  const where: Prisma.MediaAssetWhereInput = { ...publicMediaAssetWhere, ...scopeWhere(scope), ...(search ? { OR: [
    { title: { contains: search, mode: "insensitive" } }, { fileName: { contains: search, mode: "insensitive" } },
    { originalFilename: { contains: search, mode: "insensitive" } }, { altText: { contains: search, mode: "insensitive" } },
  ] } : {}) };
  const total = await prisma.mediaAsset.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const rows = await prisma.mediaAsset.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (safePage - 1) * pageSize, take: pageSize, select: { id: true, title: true, fileName: true, altText: true, thumbnailUrl: true, optimizedUrl: true, url: true } });
  return { items: rows.map((asset): MediaPickerAssetSummary => ({ id: asset.id, title: asset.title, fileName: asset.fileName, altText: asset.altText, thumbnailPublicUrl: asset.thumbnailUrl ?? asset.optimizedUrl ?? asset.url, publicUrl: asset.optimizedUrl ?? asset.url })), page: safePage, pageSize, total, pageCount };
}
