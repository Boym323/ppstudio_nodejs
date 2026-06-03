import { CategoryManagementWorkspace } from "@/components/admin/categories/CategoryManagementWorkspace";
import { type AdminArea } from "@/config/navigation";
import { AdminPageShell } from "@/features/admin/components/admin-page-shell";
import { getAdminServiceCategoriesPageData } from "@/features/admin/lib/admin-service-categories";

export async function AdminServiceCategoriesPage({
  area,
  searchParams,
}: {
  area: AdminArea;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const data = await getAdminServiceCategoriesPageData(area, searchParams);
  const selectedCategoryFromList =
    data.selectedCategory && data.categories.find((category) => category.id === data.selectedCategory?.id);

  return (
    <AdminPageShell
      eyebrow="Struktura nabídky"
      title="Kategorie služeb"
      description={
        area === "owner"
          ? "Pořadí, stav a warningy kategorií na jednom místě, aby katalog zůstal přehledný."
          : "Rychlá kontrola kategorií, které drží nabídku salonu srozumitelnou pro provoz i booking."
      }
      compact={area === "salon"}
    >
      <CategoryManagementWorkspace
        key={`${data.filters.mode}:${data.filters.mobileDetail}:${data.filters.categoryId ?? "default"}:${data.filters.query}:${data.filters.status}:${data.filters.sort}:${data.filters.flags.join(",")}`}
        area={area}
        currentPath={data.currentPath}
        servicesPath={data.servicesPath}
        stats={data.stats}
        filters={data.filters}
        categories={data.categories}
        selectedCategory={
          data.selectedCategory
            ? {
                ...data.selectedCategory,
                counts: data.selectedCategoryCounts,
                warnings: selectedCategoryFromList?.warnings ?? [],
                problemCount: selectedCategoryFromList?.problemCount ?? 0,
              }
            : null
        }
        selectedCategoryVisible={data.selectedCategoryVisible}
        initialMode={data.filters.mode}
        initialMobileDetail={data.filters.mobileDetail === "1" || data.filters.mode === "create"}
      />
    </AdminPageShell>
  );
}
