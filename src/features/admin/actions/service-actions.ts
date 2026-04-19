"use server";

import { revalidatePath } from "next/cache";

import { type AdminArea } from "@/config/navigation";
import { type UpdateServiceActionState } from "@/features/admin/actions/update-service-action-state";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";
import { updateServiceSchema } from "@/features/admin/lib/admin-service-validation";
import { prisma } from "@/lib/prisma";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function readCheckbox(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function revalidateServicePaths(area: AdminArea) {
  const servicePath = area === "owner" ? "/admin/sluzby" : "/admin/provoz/sluzby";

  for (const path of [servicePath, "/admin", "/admin/provoz", "/rezervace"]) {
    revalidatePath(path);
  }
}

export async function updateServiceAction(
  _previousState: UpdateServiceActionState,
  formData: FormData,
): Promise<UpdateServiceActionState> {
  const parsed = updateServiceSchema.safeParse({
    area: readFormString(formData, "area"),
    serviceId: readFormString(formData, "serviceId"),
    categoryId: readFormString(formData, "categoryId"),
    name: readFormString(formData, "name"),
    shortDescription: readFormString(formData, "shortDescription"),
    description: readFormString(formData, "description"),
    durationMinutes: readFormString(formData, "durationMinutes"),
    priceFromCzk: readFormString(formData, "priceFromCzk"),
    sortOrder: readFormString(formData, "sortOrder"),
    isActive: readCheckbox(formData, "isActive"),
    isPubliclyBookable: readCheckbox(formData, "isPubliclyBookable"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Formulář potřebuje doplnit nebo opravit.",
      fieldErrors: {
        name: fieldErrors.name?.[0],
        shortDescription: fieldErrors.shortDescription?.[0],
        description: fieldErrors.description?.[0],
        durationMinutes: fieldErrors.durationMinutes?.[0],
        priceFromCzk: fieldErrors.priceFromCzk?.[0],
        categoryId: fieldErrors.categoryId?.[0],
        sortOrder: fieldErrors.sortOrder?.[0],
      },
    };
  }

  const area = parsed.data.area as AdminArea;
  await requireAdminSectionAccess(area, "sluzby");

  const [service, category] = await Promise.all([
    prisma.service.findUnique({
      where: { id: parsed.data.serviceId },
      select: { id: true },
    }),
    prisma.serviceCategory.findUnique({
      where: { id: parsed.data.categoryId },
      select: { id: true, isActive: true },
    }),
  ]);

  if (!service) {
    return {
      status: "error",
      formError: "Službu se nepodařilo najít.",
    };
  }

  if (!category) {
    return {
      status: "error",
      formError: "Vybraná kategorie už v systému neexistuje.",
      fieldErrors: {
        categoryId: "Vyberte prosím existující kategorii.",
      },
    };
  }

  await prisma.service.update({
    where: { id: parsed.data.serviceId },
    data: {
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      shortDescription: parsed.data.shortDescription || null,
      description: parsed.data.description || null,
      durationMinutes: parsed.data.durationMinutes,
      priceFromCzk: parsed.data.priceFromCzk === "" ? null : parsed.data.priceFromCzk,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
      isPubliclyBookable: parsed.data.isPubliclyBookable,
    },
  });

  revalidateServicePaths(area);

  return {
    status: "success",
    successMessage: category.isActive
      ? "Služba je uložená. Nová délka a veřejná rezervovatelnost se projeví i v booking flow."
      : "Služba je uložená. Pozor jen na to, že neaktivní kategorie ji stejně skryje z veřejného bookingu.",
  };
}
