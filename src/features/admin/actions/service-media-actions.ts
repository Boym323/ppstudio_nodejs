"use server";

import { ServiceMediaRole } from "@/generated/prisma/browser";
import { revalidatePath } from "next/cache";

import { type AdminArea } from "@/config/navigation";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";
import { prisma } from "@/lib/prisma";

function read(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function ensurePublicAsset(mediaAssetId: string) {
  return prisma.mediaAsset.findFirst({
    where: { id: mediaAssetId, isPublished: true, visibility: "PUBLIC", deletionRequestedAt: null },
    select: { id: true },
  });
}

function revalidateServiceMedia() {
  revalidatePath("/sluzby");
  revalidatePath("/sluzby/[slug]", "page");
  revalidatePath("/admin/sluzby");
  revalidatePath("/admin/provoz/sluzby");
  revalidatePath("/admin/media");
  revalidatePath("/admin/provoz/media");
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
  if (!(await ensurePublicAsset(mediaAssetId))) throw new Error("Pro veřejnou službu lze vybrat jen publikované veřejné médium.");

  const existing = await prisma.serviceMedia.findFirst({ where: { serviceId, role: ServiceMediaRole.HERO }, select: { id: true } });
  if (existing) {
    await prisma.serviceMedia.update({ where: { id: existing.id }, data: { mediaAssetId, sortOrder: 0 } });
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
  if (!(await ensurePublicAsset(mediaAssetId))) throw new Error("Pro veřejnou službu lze vybrat jen publikované veřejné médium.");

  const last = await prisma.serviceMedia.aggregate({
    where: { serviceId, role: ServiceMediaRole.GALLERY },
    _max: { sortOrder: true },
  });
  await prisma.serviceMedia.upsert({
    where: { serviceId_role_mediaAssetId: { serviceId, role: ServiceMediaRole.GALLERY, mediaAssetId } },
    create: { serviceId, mediaAssetId, role: ServiceMediaRole.GALLERY, sortOrder: (last._max.sortOrder ?? -10) + 10 },
    update: {},
  });
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

export async function moveServiceGalleryMediaAction(formData: FormData) {
  const area = read(formData, "area");
  const serviceId = read(formData, "serviceId");
  const id = read(formData, "id");
  const direction = read(formData, "direction");
  await authorize(area, serviceId);
  const rows = await prisma.serviceMedia.findMany({ where: { serviceId, role: ServiceMediaRole.GALLERY }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true } });
  const index = rows.findIndex((row) => row.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= rows.length) return;
  const reordered = [...rows];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  await prisma.$transaction(reordered.map((row, sortOrder) => prisma.serviceMedia.update({ where: { id: row.id }, data: { sortOrder: (sortOrder + 1) * 10 } })));
  revalidateServiceMedia();
}
