import { AdminRole } from "@prisma/client";

export const mainNavigation = [
  { href: "/", label: "Domů" },
  { href: "/sluzby", label: "Služby" },
  { href: "/cenik", label: "Ceník" },
  { href: "/o-mne", label: "O mně" },
  { href: "/studio", label: "Studio" },
  { href: "/kontakt", label: "Kontakt" },
] as const;

export const footerNavigation = [
  { href: "/vouchery", label: "Dárkové vouchery" },
  { href: "/faq", label: "FAQ" },
  { href: "/storno-podminky", label: "Storno podmínky" },
  { href: "/obchodni-podminky", label: "Obchodní podmínky" },
  { href: "/gdpr", label: "GDPR" },
] as const;

export type AdminArea = "owner" | "salon";

export type AdminSectionSlug =
  | "overview"
  | "statistiky"
  | "rezervace"
  | "volne-terminy"
  | "vouchery"
  | "klienti"
  | "media"
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
    slug: "statistiky",
    ownerHref: "/admin/statistiky",
    salonHref: "/admin/provoz/statistiky",
    label: "KPI a statistiky",
    description: "Manažerské KPI, tržby a vývoj salonu.",
  },
  {
    slug: "rezervace",
    ownerHref: "/admin/rezervace",
    salonHref: "/admin/provoz/rezervace",
    label: "Rezervace",
    salonLabel: "Dnešní rezervace",
    description: "Potvrzené, čekající i dnešní rezervace.",
    salonDescription: "Dnešní termíny k obsluze a kontrole.",
  },
  {
    slug: "volne-terminy",
    ownerHref: "/admin/volne-terminy",
    salonHref: "/admin/provoz/volne-terminy",
    label: "Volné termíny",
    salonLabel: "Volné termíny",
    description: "Dostupnost, publikace a kontrola slotů.",
    salonDescription: "Rychlé přidání a kontrola volných termínů.",
  },
  {
    slug: "vouchery",
    ownerHref: "/admin/vouchery",
    salonHref: "/admin/provoz/vouchery",
    label: "Vouchery",
    salonLabel: "Vouchery",
    description: "Přehled voucherů, platnosti a zůstatků.",
    salonDescription: "Stav voucherů a zbývající čerpání.",
  },
  {
    slug: "klienti",
    ownerHref: "/admin/klienti",
    salonHref: "/admin/provoz/klienti",
    label: "Klienti",
    salonLabel: "Klientky",
    description: "Kontakty, návštěvy a provozní poznámky.",
    salonDescription: "Klientky a jejich předchozí návštěvy.",
  },
  {
    slug: "media",
    ownerHref: "/admin/media",
    salonHref: "/admin/provoz/media",
    label: "Média",
    salonLabel: "Média",
    description: "Obrázky, certifikáty a webové podklady.",
    salonDescription: "Nahrání a kontrola webových podkladů.",
  },
  {
    slug: "sluzby",
    ownerHref: "/admin/sluzby",
    salonHref: "/admin/provoz/sluzby",
    label: "Služby",
    salonLabel: "Služby",
    description: "Nabídka služeb, délky, ceny a rezervovatelnost.",
    salonDescription: "Přehled a úpravy nabídky služeb.",
  },
  {
    slug: "kategorie-sluzeb",
    ownerHref: "/admin/kategorie-sluzeb",
    salonHref: "/admin/provoz/kategorie-sluzeb",
    label: "Kategorie služeb",
    description: "Struktura nabídky a pořadí služeb.",
  },
] as const;

const ownerOnlySections = [
  {
    slug: "uzivatele",
    href: "/admin/uzivatele",
    label: "Přístupy",
    description: "Přístupy, role a systémové účty.",
  },
  {
    slug: "email-logy",
    href: "/admin/email-logy",
    label: "Email logy",
    description: "Potvrzení, připomínky a selhané zprávy.",
  },
  {
    slug: "nastaveni",
    href: "/admin/nastaveni",
    label: "Nastavení",
    description: "Kontakty, pravidla a provozní konfigurace.",
  },
] as const;

export const ownerAdminNavigation: AdminNavigationItem[] = [
  {
    href: "/admin",
    label: "Přehled",
    slug: "overview",
    description: "Rezervace, dostupnost a důležitá upozornění.",
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
    description: "Rychlý denní přehled pro provoz.",
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
