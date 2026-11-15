"use server";

import { ServiceMediaRole } from "@/generated/prisma/browser";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type AdminArea } from "@/config/navigation";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";
import { createServiceGalleryMediaWithRetry } from "@/features/admin/lib/service-media-mutations";
import { reorderServiceGallery } from "@/features/admin/lib/service-media-reorder";
import { prisma } from "@/lib/prisma";
import { isPublicMediaAsset } from "@/features/media/lib/public-media-asset";
import { createMedia, deleteMedia } from "@/features/media/lib/media-library";
import { normalizeOptionalText } from "@/features/admin/lib/admin-media-validation";

function read(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function revalidateServiceMedia() {
  revalidatePath("/");
  revalidatePath("/sluzby");
  revalidatePath("/sluzby/[slug]", "page");
  revalidatePath("/admin/sluzby");
  revalidatePath("/admin/provoz/sluzby");
  revalidatePath("/admin/media");
  revalidatePath("/admin/provoz/media");
}

function servicePath(area: AdminArea, serviceId: string, flash?: string) {
  const path = area === "owner" ? "/admin/sluzby" : "/admin/provoz/sluzby";
  const query = new URLSearchParams({ serviceId, view: "photos" });
  if (flash) query.set("mediaFlash", flash);
  return `${path}?${query}`;
}

async function authorize(area: string, serviceId: string) {
  if (area !== "owner" && area !== "salon") throw new Error("Neplatná administrační sekce.");
  await requireAdminSectionAccess(area as AdminArea, "sluzby");
  const service = await prisma.service.findUnique({ where: { id: serviceId }, select: { id: true } });
  if (!service) throw new Error("Službu se nepodařilo najít.");
}

export async function setServiceHeroMediaAction(formData: FormData) {
  const area = read(formData, "area");
  const serviceId = read(formData, "serviceId");
  const mediaAssetId = read(formData, "mediaAssetId");
  await authorize(area, serviceId);
  if (!(await isPublicMediaAsset(mediaAssetId))) throw new Error("Pro veřejnou službu lze vybrat jen publikované veřejné médium.");

  const existing = await prisma.serviceMedia.findFirst({ where: { serviceId, role: ServiceMediaRole.HERO }, select: { id: true, mediaAssetId: true } });
  if (existing) {
    await prisma.serviceMedia.update({ where: { id: existing.id }, data: { mediaAssetId, sortOrder: 0, ...(existing.mediaAssetId !== mediaAssetId ? { altText: null } : {}) } });
  } else {
    await prisma.serviceMedia.create({ data: { serviceId, mediaAssetId, role: ServiceMediaRole.HERO, sortOrder: 0 } });
  }
  revalidateServiceMedia();
}

export async function removeServiceHeroMediaAction(formData: FormData) {
  const area = read(formData, "area");
  const serviceId = read(formData, "serviceId");
  await authorize(area, serviceId);
  await prisma.serviceMedia.deleteMany({ where: { serviceId, role: ServiceMediaRole.HERO } });
  revalidateServiceMedia();
}

export async function addServiceGalleryMediaAction(formData: FormData) {
  const area = read(formData, "area");
  const serviceId = read(formData, "serviceId");
  const mediaAssetId = read(formData, "mediaAssetId");
  await authorize(area, serviceId);
  if (!(await isPublicMediaAsset(mediaAssetId))) throw new Error("Pro veřejnou službu lze vybrat jen publikované veřejné médium.");
  await createServiceGalleryMediaWithRetry(serviceId, mediaAssetId);
  revalidateServiceMedia();
}

export async function removeServiceGalleryMediaAction(formData: FormData) {
  const area = read(formData, "area");
  const serviceId = read(formData, "serviceId");
  const id = read(formData, "id");
  await authorize(area, serviceId);
  await prisma.serviceMedia.deleteMany({ where: { id, serviceId, role: ServiceMediaRole.GALLERY } });
  revalidateServiceMedia();
}

export async function updateServiceMediaAltTextAction(formData: FormData) {
  const area = read(formData, "area");
  const serviceId = read(formData, "serviceId");
  const id = read(formData, "id");
  const altText = read(formData, "altText").trim();
  await authorize(area, serviceId);
  if (!id || altText.length > 160) throw new Error("Neplatný alt text fotografie.");
  await prisma.serviceMedia.updateMany({
    where: { id, serviceId },
    data: { altText: altText || null },
  });
  revalidateServiceMedia();
}

export async function moveServiceGalleryMediaAction(formData: FormData) {
  const area = read(formData, "area");
  const serviceId = read(formData, "serviceId");
  const id = read(formData, "id");
  const direction = read(formData, "direction");
  await authorize(area, serviceId);
  await prisma.$transaction((tx) => reorderServiceGallery(tx, serviceId, id, direction === "up" ? "up" : "down"));
  revalidateServiceMedia();
}

export async function uploadServiceMediaAction(formData: FormData) {
  const area = read(formData, "area");
  const serviceId = read(formData, "serviceId");
  const role = read(formData, "serviceRole");
  await authorize(area, serviceId);
  if (role !== "HERO" && role !== "GALLERY") redirect(servicePath(area as AdminArea, serviceId, "invalid"));

  const file = formData.get("file");
  if (!(file instanceof File) || file.size <= 0) redirect(servicePath(area as AdminArea, serviceId, "missing-file"));

  const isPublished = formData.get("isPublished") === "true";
  let assetId: string | undefined;
  try {
    const asset = await createMedia({
      file,
      isPublished,
      title: normalizeOptionalText(read(formData, "title")),
      altText: normalizeOptionalText(read(formData, "altText")),
    });
    assetId = asset.id;
    if (role === "HERO") {
      await prisma.serviceMedia.upsert({
        where: { serviceId_role_sortOrder: { serviceId, role: ServiceMediaRole.HERO, sortOrder: 0 } },
        update: { mediaAssetId: asset.id, altText: null },
        create: { serviceId, mediaAssetId: asset.id, role: ServiceMediaRole.HERO, sortOrder: 0 },
      });
    } else {
      await createServiceGalleryMediaWithRetry(serviceId, asset.id);
    }
  } catch (error) {
    if (assetId) {
      try { await deleteMedia(assetId); } catch { /* orphan cleanup is handled by the media audit */ }
    }
    console.error("Service media upload failed", { serviceId, role, error });
    redirect(servicePath(area as AdminArea, serviceId, "failed"));
  }

  revalidateServiceMedia();
  redirect(servicePath(area as AdminArea, serviceId, "success"));
}
