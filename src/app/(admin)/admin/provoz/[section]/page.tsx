import { notFound } from "next/navigation";

import { AdminSectionPage } from "@/features/admin/components/admin-section-page";
import {
  isAdminSectionSlug,
  requireAdminSectionAccess,
} from "@/features/admin/lib/admin-guards";

type SalonAdminSectionPageProps = {
  params: Promise<{
    section: string;
  }>;
};

export default async function SalonAdminSectionPage({
  params,
}: SalonAdminSectionPageProps) {
  const { section } = await params;

  if (!isAdminSectionSlug(section)) {
    notFound();
  }

  await requireAdminSectionAccess("salon", section);

  return <AdminSectionPage area="salon" section={section} />;
}
