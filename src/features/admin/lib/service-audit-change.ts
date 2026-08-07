import { buildAuditChange } from "@/features/admin/lib/audit-change";

export type ServiceAuditState = {
  categoryId: string;
  name: string;
  publicName: string | null;
  seoTitle: string | null;
  description: string | null;
  publicIntro: string | null;
  seoDescription: string | null;
  idealFor: string[];
  includes: string[];
  benefits: string[];
  goodToKnow: string[];
  pricingShortDescription: string | null;
  pricingBadge: string | null;
  durationMinutes: number;
  cleanupMinutes: number;
  priceFromCzk: number | null;
  sortOrder: number;
  isFeaturedOnHomepage: boolean;
  homepageSortOrder: number;
  isActive: boolean;
  isPubliclyBookable: boolean;
};

const contentFields = ["description", "publicIntro", "seoDescription", "idealFor", "includes", "benefits", "goodToKnow", "pricingShortDescription", "pricingBadge"] as const;

export function buildServiceOperationalAuditChange(current: ServiceAuditState, next: ServiceAuditState) {
  const changedContentFields = contentFields.filter(
    (key) => JSON.stringify(current[key]) !== JSON.stringify(next[key]),
  );
  return buildAuditChange(
    {
      categoryId: current.categoryId,
      name: current.name,
      publicName: current.publicName,
      seoTitle: current.seoTitle,
      durationMinutes: current.durationMinutes,
      cleanupMinutes: current.cleanupMinutes,
      sortOrder: current.sortOrder,
      isFeaturedOnHomepage: current.isFeaturedOnHomepage,
      homepageSortOrder: current.homepageSortOrder,
      isActive: current.isActive,
      isPubliclyBookable: current.isPubliclyBookable,
      publicContentFields: [],
    },
    {
      categoryId: next.categoryId,
      name: next.name,
      publicName: next.publicName,
      seoTitle: next.seoTitle,
      durationMinutes: next.durationMinutes,
      cleanupMinutes: next.cleanupMinutes,
      sortOrder: next.sortOrder,
      isFeaturedOnHomepage: next.isFeaturedOnHomepage,
      homepageSortOrder: next.homepageSortOrder,
      isActive: next.isActive,
      isPubliclyBookable: next.isPubliclyBookable,
      publicContentFields: changedContentFields,
    },
  );
}
