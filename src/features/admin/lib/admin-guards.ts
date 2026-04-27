import { notFound } from "next/navigation";

import {
  ownerOnlyAdminSectionSlugs,
  sharedAdminSectionSlugs,
  type AdminArea,
  type AdminSectionSlug,
} from "@/config/navigation";
import { requireAdminArea } from "@/lib/auth/session";

const sectionSlugs = new Set<AdminSectionSlug>([
  "overview",
  "rezervace",
  "volne-terminy",
  "vouchery",
  "klienti",
  "media",
  "sluzby",
  "kategorie-sluzeb",
  "uzivatele",
  "email-logy",
  "nastaveni",
]);

export function isAdminSectionSlug(value: string): value is Exclude<AdminSectionSlug, "overview"> {
  return value !== "overview" && sectionSlugs.has(value as AdminSectionSlug);
}

export async function requireAdminSectionAccess(
  area: AdminArea,
  section: Exclude<AdminSectionSlug, "overview">,
) {
  const session = await requireAdminArea(area);

  if (area === "salon" && !sharedAdminSectionSlugs.has(section)) {
    notFound();
  }

  if (
    area === "owner" &&
    !sharedAdminSectionSlugs.has(section) &&
    !ownerOnlyAdminSectionSlugs.has(section)
  ) {
    notFound();
  }

  return session;
}
