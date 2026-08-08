"use server";

import { ServiceChangeOperation } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { type AdminArea } from "@/config/navigation";
import { type UpdateServiceActionState } from "@/features/admin/actions/update-service-action-state";
import { requireAdminSectionAccess } from "@/features/admin/lib/admin-guards";
import {
  createServiceSchema,
  updateServiceSchema,
} from "@/features/admin/lib/admin-service-validation";
import { prisma } from "@/lib/prisma";
import { runSerializableTransaction } from "@/lib/serializable-transaction";
import { buildServiceOperationalAuditChange } from "@/features/admin/lib/service-audit-change";
import { toggleServiceOperationalFlag } from "@/features/admin/lib/service-change-operations";

function readFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function readCheckbox(formData: FormData, key: string) {
  const value = formData.get(key);

  return value === "on" || value === "true";
}

function safeReturnPath(value: string | undefined, fallback: string) {
  if (!value || !value.startsWith("/")) {
    return fallback;
  }

  return value;
}

function getServiceBasePath(area: AdminArea) {
  return area === "owner" ? "/admin/sluzby" : "/admin/provoz/sluzby";
}

function revalidateServicePaths(area: AdminArea) {
  const servicePath = getServiceBasePath(area);

  for (const path of [servicePath, "/admin", "/admin/provoz", "/", "/rezervace", "/sluzby", "/cenik"]) {
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

async function createUniqueServiceSlug(baseName: string) {
  const baseSlug = slugifyValue(baseName) || "sluzba";

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    const existing = await prisma.service.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) {
      return slug;
    }
  }

  return `${baseSlug}-${Date.now()}`;
}

async function buildDuplicateServiceName(name: string) {
  const baseName = `${name} kopie`;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = attempt === 0 ? baseName : `${baseName} ${attempt + 1}`;
    const existing = await prisma.service.findFirst({
      where: { name: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  return `${baseName} ${Date.now()}`;
}

const serviceAuditSelect = {
  id: true,
  categoryId: true,
  category: { select: { name: true } },
  name: true,
  publicName: true,
  seoTitle: true,
  description: true,
  publicIntro: true,
  seoDescription: true,
  idealFor: true,
  includes: true,
  benefits: true,
  goodToKnow: true,
  pricingShortDescription: true,
  pricingBadge: true,
  durationMinutes: true,
  cleanupMinutes: true,
  priceFromCzk: true,
  sortOrder: true,
  isFeaturedOnHomepage: true,
  homepageSortOrder: true,
  isActive: true,
  isPubliclyBookable: true,
} as const;

async function reorderServicesWithinCategory(categoryId: string, movedServiceId: string, direction: "up" | "down") {
  return prisma.$transaction(async (tx) => {
    const services = await tx.service.findMany({
      where: { categoryId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      select: { id: true },
    });

    const currentIndex = services.findIndex((service) => service.id === movedServiceId);

    if (currentIndex === -1) {
      return;
    }

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= services.length) {
      return;
    }

    const reordered = [...services];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    await Promise.all(
      reordered.map((service, index) =>
        tx.service.update({
          where: { id: service.id },
          data: { sortOrder: (index + 1) * 10 },
        }),
      ),
    );
  });
}

export async function createServiceAction(
  _previousState: UpdateServiceActionState,
  formData: FormData,
): Promise<UpdateServiceActionState> {
  const parsed = createServiceSchema.safeParse({
    area: readFormString(formData, "area"),
    returnTo: readFormString(formData, "returnTo"),
    categoryId: readFormString(formData, "categoryId"),
    name: readFormString(formData, "name"),
    publicName: readFormString(formData, "publicName"),
    description: readFormString(formData, "description"),
    publicIntro: readFormString(formData, "publicIntro"),
    seoTitle: readFormString(formData, "seoTitle"),
    seoDescription: readFormString(formData, "seoDescription"),
    idealFor: readFormString(formData, "idealFor"),
    includes: readFormString(formData, "includes"),
    benefits: readFormString(formData, "benefits"),
    goodToKnow: readFormString(formData, "goodToKnow"),
    pricingShortDescription: readFormString(formData, "pricingShortDescription"),
    pricingBadge: readFormString(formData, "pricingBadge"),
    durationMinutes: readFormString(formData, "durationMinutes"),
    cleanupMinutes: readFormString(formData, "cleanupMinutes") || "0",
    priceFromCzk: readFormString(formData, "priceFromCzk"),
    isFeaturedOnHomepage: readCheckbox(formData, "isFeaturedOnHomepage"),
    homepageSortOrder: readFormString(formData, "homepageSortOrder"),
    isActive: readCheckbox(formData, "isActive"),
    isPubliclyBookable: readCheckbox(formData, "isPubliclyBookable"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      status: "error",
      formError: "Novou službu je potřeba ještě doplnit nebo opravit.",
      fieldErrors: {
        name: fieldErrors.name?.[0],
        publicName: fieldErrors.publicName?.[0],
        description: fieldErrors.description?.[0],
        publicIntro: fieldErrors.publicIntro?.[0],
        seoTitle: fieldErrors.seoTitle?.[0],
        seoDescription: fieldErrors.seoDescription?.[0],
        idealFor: fieldErrors.idealFor?.[0],
        includes: fieldErrors.includes?.[0],
        benefits: fieldErrors.benefits?.[0],
        goodToKnow: fieldErrors.goodToKnow?.[0],
        pricingShortDescription: fieldErrors.pricingShortDescription?.[0],
        pricingBadge: fieldErrors.pricingBadge?.[0],
        durationMinutes: fieldErrors.durationMinutes?.[0],
        cleanupMinutes: fieldErrors.cleanupMinutes?.[0],
        priceFromCzk: fieldErrors.priceFromCzk?.[0],
        categoryId: fieldErrors.categoryId?.[0],
        homepageSortOrder: fieldErrors.homepageSortOrder?.[0],
      },
    };
  }

  const area = parsed.data.area as AdminArea;
  await requireAdminSectionAccess(area, "sluzby");

  const category = await prisma.serviceCategory.findUnique({
    where: { id: parsed.data.categoryId },
    select: { id: true },
  });

  if (!category) {
    return {
      status: "error",
      formError: "Vybraná kategorie už v systému neexistuje.",
      fieldErrors: {
        categoryId: "Vyberte prosím existující kategorii.",
      },
    };
  }

  const [maxSortOrder, slug] = await Promise.all([
    prisma.service.aggregate({
      where: { categoryId: parsed.data.categoryId },
      _max: { sortOrder: true },
    }),
    createUniqueServiceSlug(parsed.data.name),
  ]);

  const service = await prisma.service.create({
    data: {
      categoryId: parsed.data.categoryId,
      slug,
      name: parsed.data.name,
      publicName: parsed.data.publicName || null,
      shortDescription: null,
      description: parsed.data.description || null,
      publicIntro: parsed.data.publicIntro || null,
      seoTitle: parsed.data.seoTitle || null,
      seoDescription: parsed.data.seoDescription || null,
      idealFor: parsed.data.idealFor,
      includes: parsed.data.includes,
      benefits: parsed.data.benefits,
      goodToKnow: parsed.data.goodToKnow,
      pricingShortDescription: parsed.data.pricingShortDescription || null,
      pricingBadge: parsed.data.pricingBadge || null,
      durationMinutes: parsed.data.durationMinutes,
      cleanupMinutes: parsed.data.cleanupMinutes,
      priceFromCzk: parsed.data.priceFromCzk === "" ? null : parsed.data.priceFromCzk,
      sortOrder: (maxSortOrder._max.sortOrder ?? 0) + 10,
      isFeaturedOnHomepage: parsed.data.isFeaturedOnHomepage,
      homepageSortOrder: parsed.data.homepageSortOrder,
      isActive: parsed.data.isActive,
      isPubliclyBookable: parsed.data.isPubliclyBookable,
    },
    select: { id: true },
  });

  revalidateServicePaths(area);

  const basePath = getServiceBasePath(area);
  const returnTo = safeReturnPath(parsed.data.returnTo, basePath);
  const separator = returnTo.includes("?") ? "&" : "?";

  redirect(`${returnTo}${separator}serviceId=${service.id}`);
}

export async function updateServiceAction(
  _previousState: UpdateServiceActionState,
  formData: FormData,
): Promise<UpdateServiceActionState> {
  const parsed = updateServiceSchema.safeParse({
    area: readFormString(formData, "area"),
    serviceId: readFormString(formData, "serviceId"),
    returnTo: readFormString(formData, "returnTo"),
    intent: readFormString(formData, "intent") || undefined,
    categoryId: readFormString(formData, "categoryId"),
    name: readFormString(formData, "name"),
    publicName: readFormString(formData, "publicName"),
    description: readFormString(formData, "description"),
    publicIntro: readFormString(formData, "publicIntro"),
    seoTitle: readFormString(formData, "seoTitle"),
    seoDescription: readFormString(formData, "seoDescription"),
    idealFor: readFormString(formData, "idealFor"),
    includes: readFormString(formData, "includes"),
    benefits: readFormString(formData, "benefits"),
    goodToKnow: readFormString(formData, "goodToKnow"),
    pricingShortDescription: readFormString(formData, "pricingShortDescription"),
    pricingBadge: readFormString(formData, "pricingBadge"),
    durationMinutes: readFormString(formData, "durationMinutes"),
    cleanupMinutes: readFormString(formData, "cleanupMinutes") || "0",
    priceFromCzk: readFormString(formData, "priceFromCzk"),
    sortOrder: readFormString(formData, "sortOrder"),
    isFeaturedOnHomepage: readCheckbox(formData, "isFeaturedOnHomepage"),
    homepageSortOrder: readFormString(formData, "homepageSortOrder"),
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
        publicName: fieldErrors.publicName?.[0],
        description: fieldErrors.description?.[0],
        publicIntro: fieldErrors.publicIntro?.[0],
        seoTitle: fieldErrors.seoTitle?.[0],
        seoDescription: fieldErrors.seoDescription?.[0],
        idealFor: fieldErrors.idealFor?.[0],
        includes: fieldErrors.includes?.[0],
        benefits: fieldErrors.benefits?.[0],
        goodToKnow: fieldErrors.goodToKnow?.[0],
        pricingShortDescription: fieldErrors.pricingShortDescription?.[0],
        pricingBadge: fieldErrors.pricingBadge?.[0],
        durationMinutes: fieldErrors.durationMinutes?.[0],
        cleanupMinutes: fieldErrors.cleanupMinutes?.[0],
        priceFromCzk: fieldErrors.priceFromCzk?.[0],
        categoryId: fieldErrors.categoryId?.[0],
        sortOrder: fieldErrors.sortOrder?.[0],
        homepageSortOrder: fieldErrors.homepageSortOrder?.[0],
      },
    };
  }

  const area = parsed.data.area as AdminArea;
  const basePath = getServiceBasePath(area);
  const returnTo = safeReturnPath(parsed.data.returnTo, basePath);
  const session = await requireAdminSectionAccess(area, "sluzby");
  const actorUserId = session.sub;
  const nextPriceFromCzk = parsed.data.priceFromCzk === "" ? null : parsed.data.priceFromCzk;

  const category = await prisma.serviceCategory.findUnique({
    where: { id: parsed.data.categoryId },
    select: { id: true, name: true, isActive: true },
  });

  if (!category) {
    return {
      status: "error",
      formError: "Vybraná kategorie už v systému neexistuje.",
      fieldErrors: {
        categoryId: "Vyberte prosím existující kategorii.",
      },
    };
  }

  const serviceFound = await runSerializableTransaction(async (tx) => {
    const service = await tx.service.findUnique({
      where: { id: parsed.data.serviceId },
      select: serviceAuditSelect,
    });
    if (!service) return false;
    const nextValues = {
      categoryId: parsed.data.categoryId,
      categoryName: category.name,
      name: parsed.data.name,
      publicName: parsed.data.publicName || null,
      seoTitle: parsed.data.seoTitle || null,
      description: parsed.data.description || null,
      publicIntro: parsed.data.publicIntro || null,
      seoDescription: parsed.data.seoDescription || null,
      idealFor: parsed.data.idealFor,
      includes: parsed.data.includes,
      benefits: parsed.data.benefits,
      goodToKnow: parsed.data.goodToKnow,
      pricingShortDescription: parsed.data.pricingShortDescription || null,
      pricingBadge: parsed.data.pricingBadge || null,
      durationMinutes: parsed.data.durationMinutes,
      cleanupMinutes: parsed.data.cleanupMinutes,
      priceFromCzk: nextPriceFromCzk,
      sortOrder: parsed.data.sortOrder,
      isFeaturedOnHomepage: parsed.data.isFeaturedOnHomepage,
      homepageSortOrder: parsed.data.homepageSortOrder,
      isActive: parsed.data.isActive,
      isPubliclyBookable: parsed.data.isPubliclyBookable,
    };
    const auditChange = buildServiceOperationalAuditChange({ ...service, categoryName: service.category.name }, nextValues);
    await tx.service.update({
      where: { id: parsed.data.serviceId },
      data: {
        categoryId: parsed.data.categoryId,
        name: parsed.data.name,
        publicName: parsed.data.publicName || null,
        shortDescription: null,
        description: parsed.data.description || null,
        publicIntro: parsed.data.publicIntro || null,
        seoTitle: parsed.data.seoTitle || null,
        seoDescription: parsed.data.seoDescription || null,
        idealFor: parsed.data.idealFor,
        includes: parsed.data.includes,
        benefits: parsed.data.benefits,
        goodToKnow: parsed.data.goodToKnow,
        pricingShortDescription: parsed.data.pricingShortDescription || null,
        pricingBadge: parsed.data.pricingBadge || null,
        durationMinutes: parsed.data.durationMinutes,
        cleanupMinutes: parsed.data.cleanupMinutes,
        priceFromCzk: nextPriceFromCzk,
        sortOrder: parsed.data.sortOrder,
        isFeaturedOnHomepage: parsed.data.isFeaturedOnHomepage,
        homepageSortOrder: parsed.data.homepageSortOrder,
        isActive: parsed.data.isActive,
        isPubliclyBookable: parsed.data.isPubliclyBookable,
      },
    });

    if (service.priceFromCzk !== nextPriceFromCzk) {
      await tx.servicePriceChangeLog.create({
        data: {
          serviceId: service.id,
          changedByUserId: actorUserId,
          oldPriceFromCzk: service.priceFromCzk,
          newPriceFromCzk: nextPriceFromCzk,
        },
      });
    }
    if (auditChange) {
      await tx.serviceChangeLog.create({
        data: {
          serviceId: service.id,
          actorUserId,
          operation: ServiceChangeOperation.UPDATE_OPERATIONAL_DETAILS,
          ...auditChange,
        },
      });
    }
    return true;
  });

  if (!serviceFound) {
    return { status: "error", formError: "Službu se nepodařilo najít." };
  }

  revalidateServicePaths(area);

  if (parsed.data.intent === "save-close") {
    redirect(returnTo);
  }

  return {
    status: "success",
    successMessage: category.isActive
      ? "Služba je uložená. Nová délka a veřejná rezervovatelnost se projeví i v booking flow."
      : "Služba je uložená. Pozor jen na to, že neaktivní kategorie ji stejně skryje z veřejného bookingu.",
  };
}

export async function toggleServiceActiveAction(formData: FormData): Promise<void> {
  const area = readFormString(formData, "area") as AdminArea;
  const serviceId = readFormString(formData, "serviceId");
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), getServiceBasePath(area));
  const session = await requireAdminSectionAccess(area, "sluzby");

  const updated = await toggleServiceOperationalFlag({ serviceId, actorUserId: session.sub, field: "isActive" });

  if (!updated) {
    redirect(returnTo);
  }

  revalidateServicePaths(area);
  redirect(returnTo);
}

export async function toggleServiceBookableAction(formData: FormData): Promise<void> {
  const area = readFormString(formData, "area") as AdminArea;
  const serviceId = readFormString(formData, "serviceId");
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), getServiceBasePath(area));
  const session = await requireAdminSectionAccess(area, "sluzby");

  const updated = await toggleServiceOperationalFlag({ serviceId, actorUserId: session.sub, field: "isPubliclyBookable" });

  if (!updated) {
    redirect(returnTo);
  }

  revalidateServicePaths(area);
  redirect(returnTo);
}

export async function duplicateServiceAction(formData: FormData): Promise<void> {
  const area = readFormString(formData, "area") as AdminArea;
  const serviceId = readFormString(formData, "serviceId");
  const basePath = getServiceBasePath(area);
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), basePath);
  await requireAdminSectionAccess(area, "sluzby");

  const source = await prisma.service.findUnique({
    where: { id: serviceId },
    select: {
      id: true,
      categoryId: true,
      name: true,
      publicName: true,
      shortDescription: true,
      description: true,
      publicIntro: true,
      seoTitle: true,
      seoDescription: true,
      idealFor: true,
      includes: true,
      benefits: true,
      goodToKnow: true,
      pricingShortDescription: true,
      pricingBadge: true,
      durationMinutes: true,
      cleanupMinutes: true,
      priceFromCzk: true,
      sortOrder: true,
      isFeaturedOnHomepage: true,
      homepageSortOrder: true,
      isActive: true,
      isPubliclyBookable: true,
    },
  });

  if (!source) {
    redirect(returnTo);
  }

  const [name, slug] = await Promise.all([
    buildDuplicateServiceName(source.name),
    createUniqueServiceSlug(`${source.name} kopie`),
  ]);

  const duplicatedService = await prisma.$transaction(async (tx) => {
    const created = await tx.service.create({
      data: {
        categoryId: source.categoryId,
        slug,
        name,
        publicName: source.publicName,
        shortDescription: null,
        description: source.description,
        publicIntro: source.publicIntro,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        idealFor: source.idealFor,
        includes: source.includes,
        benefits: source.benefits,
        goodToKnow: source.goodToKnow,
        pricingShortDescription: source.pricingShortDescription,
        pricingBadge: source.pricingBadge,
        durationMinutes: source.durationMinutes,
        cleanupMinutes: source.cleanupMinutes,
        priceFromCzk: source.priceFromCzk,
        sortOrder: source.sortOrder + 1,
        isFeaturedOnHomepage: false,
        homepageSortOrder: source.homepageSortOrder,
        isActive: source.isActive,
        isPubliclyBookable: source.isPubliclyBookable,
      },
      select: {
        id: true,
        categoryId: true,
      },
    });

    const ordered = await tx.service.findMany({
      where: { categoryId: source.categoryId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      select: { id: true },
    });

    const sourceIndex = ordered.findIndex((service) => service.id === source.id);
    const createdIndex = ordered.findIndex((service) => service.id === created.id);

    if (sourceIndex !== -1 && createdIndex !== -1) {
      const reordered = [...ordered];
      const [moved] = reordered.splice(createdIndex, 1);
      reordered.splice(sourceIndex + 1, 0, moved);

      await Promise.all(
        reordered.map((service, index) =>
          tx.service.update({
            where: { id: service.id },
            data: { sortOrder: (index + 1) * 10 },
          }),
        ),
      );
    }

    return created;
  });

  revalidateServicePaths(area);
  const separator = returnTo.includes("?") ? "&" : "?";
  redirect(`${returnTo}${separator}serviceId=${duplicatedService.id}`);
}

export async function moveServiceAction(formData: FormData): Promise<void> {
  const area = readFormString(formData, "area") as AdminArea;
  const serviceId = readFormString(formData, "serviceId");
  const categoryId = readFormString(formData, "categoryId");
  const direction = readFormString(formData, "direction") === "down" ? "down" : "up";
  const returnTo = safeReturnPath(readFormString(formData, "returnTo"), getServiceBasePath(area));
  await requireAdminSectionAccess(area, "sluzby");

  await reorderServicesWithinCategory(categoryId, serviceId, direction);

  revalidateServicePaths(area);
  redirect(returnTo);
}
