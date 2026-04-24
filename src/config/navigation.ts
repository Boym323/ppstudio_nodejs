import { AdminRole } from "@prisma/client";

export const mainNavigation = [
  { href: "/", label: "Domů" },
  { href: "/sluzby", label: "Služby" },
  { href: "/cenik", label: "Ceník" },
  { href: "/o-mne", label: "O mně" },
  { href: "/kontakt", label: "Kontakt" },
] as const;

export const footerNavigation = [
  { href: "/faq", label: "FAQ" },
  { href: "/storno-podminky", label: "Storno podmínky" },
  { href: "/obchodni-podminky", label: "Obchodní podmínky" },
  { href: "/gdpr", label: "GDPR" },
] as const;

export type AdminArea = "owner" | "salon";

export type AdminSectionSlug =
  | "overview"
  | "rezervace"
  | "volne-terminy"
  | "klienti"
  | "certifikaty"
  | "sluzby"
  | "kategorie-sluzeb"
  | "uzivatele"
  | "email-logy"
  | "nastaveni";

export type AdminNavigationItem = {
  href: string;
  label: string;
  slug: AdminSectionSlug;
  description: string;
};

const sharedSections = [
  {
    slug: "rezervace",
    ownerHref: "/admin/rezervace",
    salonHref: "/admin/provoz/rezervace",
    label: "Rezervace",
    salonLabel: "Dnešní rezervace",
    description: "Přehled potvrzených, čekajících i dnešních rezervací.",
    salonDescription: "Termíny, které je potřeba dnes odbavit nebo zkontrolovat.",
  },
  {
    slug: "volne-terminy",
    ownerHref: "/admin/volne-terminy",
    salonHref: "/admin/provoz/volne-terminy",
    label: "Volné termíny",
    salonLabel: "Termíny",
    description: "Ruční publikace a rychlá kontrola dostupných slotů.",
    salonDescription: "Rychlé přidání nového termínu a kontrola toho, co je volné.",
  },
  {
    slug: "klienti",
    ownerHref: "/admin/klienti",
    salonHref: "/admin/provoz/klienti",
    label: "Klienti",
    salonLabel: "Klientky",
    description: "Kontakty, historie rezervací a provozní poznámky ke klientům.",
    salonDescription: "Rychlý přístup ke klientkám a jejich předchozím návštěvám.",
  },
  {
    slug: "certifikaty",
    ownerHref: "/admin/certifikaty",
    salonHref: "/admin/provoz/certifikaty",
    label: "Média webu",
    salonLabel: "Média webu",
    description: "Jednoduchá správa obrázků pro web včetně certifikátů.",
    salonDescription: "Nahrání a kontrola obrázků používaných na webu.",
  },
  {
    slug: "sluzby",
    ownerHref: "/admin/sluzby",
    salonHref: "/admin/provoz/sluzby",
    label: "Služby",
    salonLabel: "Nabídka",
    description: "Správa nabídky služeb, délek, cen a veřejné rezervovatelnosti.",
    salonDescription: "Rychlý přehled a jednoduchá editace nabídky pro běžný provoz.",
  },
  {
    slug: "kategorie-sluzeb",
    ownerHref: "/admin/kategorie-sluzeb",
    salonHref: "/admin/provoz/kategorie-sluzeb",
    label: "Kategorie služeb",
    description: "Struktura katalogu a pořadí služeb na webu.",
  },
] as const;

const ownerOnlySections = [
  {
    slug: "uzivatele",
    href: "/admin/uzivatele",
    label: "Uživatelé / role",
    description: "Přístupy administrace, role a zodpovědnosti.",
  },
  {
    slug: "email-logy",
    href: "/admin/email-logy",
    label: "Email logy",
    description: "Audit potvrzení, připomínek a selhaných zpráv.",
  },
  {
    slug: "nastaveni",
    href: "/admin/nastaveni",
    label: "Nastavení",
    description: "Serverově spravované hodnoty a provozní konfigurace.",
  },
] as const;

export const ownerAdminNavigation: AdminNavigationItem[] = [
  {
    href: "/admin",
    label: "Přehled",
    slug: "overview",
    description: "Manažerský souhrn výkonu, rezervací a provozních rizik.",
  },
  ...sharedSections.map((section) => ({
    href: section.ownerHref,
    label: section.label,
    slug: section.slug,
    description: section.description,
  })),
  ...ownerOnlySections,
];

export const salonAdminNavigation: AdminNavigationItem[] = [
  {
    href: "/admin/provoz",
    label: "Přehled",
    slug: "overview",
    description: "Rychlý denní přehled bez technického balastu.",
  },
  ...sharedSections.map((section) => ({
    href: section.salonHref,
    label: "salonLabel" in section ? section.salonLabel : section.label,
    slug: section.slug,
    description:
      "salonDescription" in section ? section.salonDescription : section.description,
  })),
];

export const ownerOnlyAdminSectionSlugs = new Set<AdminSectionSlug>(
  ownerOnlySections.map((section) => section.slug),
);

export const sharedAdminSectionSlugs = new Set<AdminSectionSlug>(
  sharedSections.map((section) => section.slug),
);

export function getAdminHomeHref(role: AdminRole) {
  return role === AdminRole.OWNER ? "/admin" : "/admin/provoz";
}

export function getAdminNavigation(
  area: AdminArea,
  currentRole: AdminRole,
): AdminNavigationItem[] {
  if (area === "salon") {
    return salonAdminNavigation;
  }

  return currentRole === AdminRole.OWNER ? ownerAdminNavigation : salonAdminNavigation;
}
