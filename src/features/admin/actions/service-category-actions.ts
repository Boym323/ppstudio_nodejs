"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type AdminArea } from "@/config/navigation";
import {
  initialUpdateServiceCategoryActionState,
  type UpdateServiceCategoryActionState,
} from "@/features/admin/actions/update-service-category-action-state";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";
import {
  createServiceCategorySchema,
  deleteServiceCategorySchema,
  updateServiceCategorySchema,
} from "@/features/admin/lib/admin-service-category-validation";
import { prisma } from "@/lib/prisma";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function readCheckbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function getCategoryBasePath(area: AdminArea) {
  return area === "owner" ? "/admin/kategorie-sluzeb" : "/admin/provoz/kategorie-sluzeb";
}

function safeReturnPath(value: string | undefined, fallback: string) {
  if (!value || !value.startsWith("/")) {
    return fallback;
  }

  return value;
}

function revalidateServiceCategoryPaths(area: AdminArea) {
  const categoryPath = getCategoryBasePath(area);
  const servicePath = area === "owner" ? "/admin/sluzby" : "/admin/provoz/sluzby";

  for (const path of [
    categoryPath,
    servicePath,
    "/admin",
    "/admin/provoz",
    "/sluzby",
    "/cenik",
    "/rezervace",
  ]) {
    revalidatePath(path);
  }
}

function slugifyValue(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

async function createUniqueCategorySlug(baseName: string) {
  const baseSlug = slugifyValue(baseName) || "kategorie";

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const existing = await prisma.serviceCategory.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) {
      return slug;
    }
  }

  return `${baseSlug}-${Date.now()}`;
}

async function reorderCategories(categoryId: string, direction: "up" | "down") {
  return prisma.$transaction(async (tx) => {
    const categories = await tx.serviceCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      select: { id: true },
    });

    const currentIndex = categories.findIndex((category) => category.id === categoryId);

    if (currentIndex === -1) {
      return;
    }

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= categories.length) {
      return;
    }

    const reordered = [...categories];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    await Promise.all(
      reordered.map((category, index) =>
        tx.serviceCategory.update({
          where: { id: category.id },
          data: { sortOrder: (index + 1) * 10 },
        }),
      ),
    );
  });
}

export async function createServiceCategoryAction(
  previousState: UpdateServiceCategoryActionState = initialUpdateServiceCategoryActionState,
  formData: FormData,
): Promise<UpdateServiceCategoryActionState> {
  void previousState;

  const parsed = createServiceCategorySchema.safeParse({
    area: readFormString(formData, "area"),
    returnTo: readFormString(formData, "returnTo"),
    name: readFormString(formData, "name"),
    description: readFormString(formData, "description"),
    isActive: readCheckbox(formData, "isActive"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Novou kategorii je potřeba ještě doplnit nebo opravit.",
      fieldErrors: {
        name: fieldErrors.name?.[0],
        description: fieldErrors.description?.[0],
      },
    };
  }

  const area = parsed.data.area as AdminArea;
  await requireAdminSectionAccess(area, "kategorie-sluzeb");

  const [slug, maxSortOrder] = await Promise.all([
    createUniqueCategorySlug(parsed.data.name),
    prisma.serviceCategory.aggregate({
      _max: { sortOrder: true },
    }),
  ]);

  const category = await prisma.serviceCategory.create({
    data: {
      slug,
      name: parsed.data.name,
      description: parsed.data.description || null,
      sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 10,
      isActive: parsed.data.isActive,
    },
    select: { id: true },
  });

  revalidateServiceCategoryPaths(area);

  const basePath = getCategoryBasePath(area);
  const returnTo = safeReturnPath(parsed.data.returnTo, basePath);
  const separator = returnTo.includes("?") ? "&" : "?";

  redirect(`${returnTo}${separator}categoryId=${category.id}`);
}

export async function updateServiceCategoryAction(
  previousState: UpdateServiceCategoryActionState = initialUpdateServiceCategoryActionState,
  formData: FormData,
): Promise<UpdateServiceCategoryActionState> {
  void previousState;

  const parsed = updateServiceCategorySchema.safeParse({
    area: readFormString(formData, "area"),
    categoryId: readFormString(formData, "categoryId"),
    returnTo: readFormString(formData, "returnTo"),
    intent: readFormString(formData, "intent") || undefined,
    name: readFormString(formData, "name"),
    description: readFormString(formData, "description"),
    sortOrder: readFormString(formData, "sortOrder"),
    isActive: readCheckbox(formData, "isActive"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Formulář potřebuje doplnit nebo opravit.",
      fieldErrors: {
        name: fieldErrors.name?.[0],
        description: fieldErrors.description?.[0],
        sortOrder: fieldErrors.sortOrder?.[0],
      },
    };
  }

  const area = parsed.data.area as AdminArea;
  const basePath = getCategoryBasePath(area);
  const returnTo = safeReturnPath(parsed.data.returnTo, basePath);
  await requireAdminSectionAccess(area, "kategorie-sluzeb");

  const category = await prisma.serviceCategory.findUnique({
    where: { id: parsed.data.categoryId },
    select: {
      id: true,
      _count: {
        select: {
          services: true,
        },
      },
    },
  });

  if (!category) {
    return {
      status: "error",
      formError: "Kategorii se nepodařilo najít.",
    };
  }

  await prisma.serviceCategory.update({
    where: { id: parsed.data.categoryId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
    },
  });

  revalidateServiceCategoryPaths(area);

  if (parsed.data.intent === "save-close") {
    redirect(returnTo);
  }

  return {
    status: "success",
    successMessage: parsed.data.isActive
      ? "Kategorie je uložená. Pořadí i název se projeví v adminu a veřejném výpisu služeb."
      : category._count.services > 0
        ? "Kategorie je vypnutá. Navázané služby zůstávají bezpečně zachované, ale veřejný web i booking ji schovají."
        : "Kategorie je vypnutá. Zůstává uložená pro případ, že ji budete chtít znovu použít.",
  };
}

export async function toggleServiceCategoryActiveAction(formData: FormData): Promise<void> {
  const area = readFormString(formData, "area") as AdminArea;
  const categoryId = readFormString(formData, "categoryId");
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), getCategoryBasePath(area));
  await requireAdminSectionAccess(area, "kategorie-sluzeb");

  const category = await prisma.serviceCategory.findUnique({
    where: { id: categoryId },
    select: { id: true, isActive: true },
  });

  if (!category) {
    redirect(returnTo);
  }

  await prisma.serviceCategory.update({
    where: { id: category.id },
    data: { isActive: !category.isActive },
  });

  revalidateServiceCategoryPaths(area);
  redirect(returnTo);
}

export async function moveServiceCategoryAction(formData: FormData): Promise<void> {
  const area = readFormString(formData, "area") as AdminArea;
  const categoryId = readFormString(formData, "categoryId");
  const direction = readFormString(formData, "direction") === "down" ? "down" : "up";
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), getCategoryBasePath(area));
  await requireAdminSectionAccess(area, "kategorie-sluzeb");

  await reorderCategories(categoryId, direction);

  revalidateServiceCategoryPaths(area);
  redirect(returnTo);
}

export async function deleteServiceCategoryAction(formData: FormData): Promise<void> {
  const parsed = deleteServiceCategorySchema.safeParse({
    area: readFormString(formData, "area"),
    categoryId: readFormString(formData, "categoryId"),
    currentPath: readFormString(formData, "currentPath"),
  });

  if (!parsed.success) {
    return;
  }

  const area = parsed.data.area as AdminArea;
  await requireAdminSectionAccess(area, "kategorie-sluzeb");

  const category = await prisma.serviceCategory.findUnique({
    where: { id: parsed.data.categoryId },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          services: true,
        },
      },
    },
  });

  if (!category) {
    redirect(parsed.data.currentPath);
  }

  if (category._count.services > 0) {
    redirect(parsed.data.currentPath);
  }

  await prisma.serviceCategory.delete({
    where: { id: category.id },
  });

  revalidateServiceCategoryPaths(area);
  redirect(parsed.data.currentPath);
}
