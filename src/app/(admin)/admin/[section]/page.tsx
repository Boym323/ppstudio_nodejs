import { notFound } from "next/navigation";

import { AdminSectionPage } from "@/features/admin/components/admin-section-page";
import {
  isAdminSectionSlug,
  requireAdminSectionAccess,
} from "@/features/admin/lib/admin-guards";

type OwnerAdminSectionPageProps = {
  params: Promise<{
    section: string;
  }>;
};

export default async function OwnerAdminSectionPage({
  params,
}: OwnerAdminSectionPageProps) {
  const { section } = await params;

  if (!isAdminSectionSlug(section)) {
    notFound();
  }

  await requireAdminSectionAccess("owner", section);

  return <AdminSectionPage area="owner" section={section} />;
}
