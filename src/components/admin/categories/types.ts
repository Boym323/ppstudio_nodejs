export type CategoryStatsItem = {
  label: string;
  value: string;
  tone?: "default" | "accent" | "muted";
  detail: string;
};

export type CategoryServicePreview = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  isPubliclyBookable: boolean;
};

export type CategoryCounts = {
  total: number;
  active: number;
  public: number;
};

export type CategoryRecord = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  warnings: string[];
  problemCount: number;
  counts: CategoryCounts;
  _count?: {
    services: number;
  };
  services: CategoryServicePreview[];
};

export type CategoryFiltersState = {
  query: string;
  status: string;
  sort: string;
  flags: Array<"empty" | "without-public" | "warning">;
  categoryId?: string;
  mode: "list" | "create";
  mobileDetail: "0" | "1";
};

export function getCategoryWarnings(category: Pick<CategoryRecord, "isActive" | "counts">) {
  const warnings: string[] = [];

  if (category.counts.total === 0) {
    warnings.push("Kategorie je prázdná.");
  }

  if (category.isActive && category.counts.public === 0) {
    warnings.push("Aktivní kategorie zatím nemá žádnou veřejnou službu.");
  }

  if (!category.isActive && category.counts.active > 0) {
    warnings.push("Neaktivní kategorie stále obsahuje aktivní služby.");
  }

  return warnings;
}

export function getCategorySubtitle(category: Pick<CategoryRecord, "isActive" | "counts">) {
  if (category.isActive && category.counts.public > 0) {
    return "Viditelná pro katalog a booking flow.";
  }

  if (category.isActive) {
    return "Aktivní kategorie bez veřejné služby. Zkontrolujte navázané položky.";
  }

  return "Skrytá kategorie. Služby zůstávají uložené a lze ji znovu zapnout.";
}
