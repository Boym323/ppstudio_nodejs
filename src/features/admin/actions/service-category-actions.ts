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

function revalidateServiceCategoryPaths(area: AdminArea) {
  const categoryPath = area === "owner" ? "/admin/kategorie-sluzeb" : "/admin/provoz/kategorie-sluzeb";
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

export async function updateServiceCategoryAction(
  previousState: UpdateServiceCategoryActionState = initialUpdateServiceCategoryActionState,
  formData: FormData,
): Promise<UpdateServiceCategoryActionState> {
  void previousState;

  const parsed = updateServiceCategorySchema.safeParse({
    area: readFormString(formData, "area"),
    categoryId: readFormString(formData, "categoryId"),
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

  return {
    status: "success",
    successMessage: parsed.data.isActive
      ? "Kategorie je uložená. Pořadí i název se projeví v adminu a veřejném výpisu služeb."
      : category._count.services > 0
        ? "Kategorie je vypnutá. Navázané služby zůstávají bezpečně zachované, ale veřejný web i booking ji schovají."
        : "Kategorie je vypnutá. Zůstává uložená pro případ, že ji budete chtít znovu použít.",
  };
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
