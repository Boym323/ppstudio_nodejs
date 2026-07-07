import type { AdminArea } from "@/config/navigation";

type SharedAdminSectionSlug =
  | "overview"
  | "rezervace"
  | "volne-terminy"
  | "vouchery"
  | "klienti"
  | "media"
  | "sluzby"
  | "kategorie-sluzeb";

const ownerSectionPaths = {
  overview: "/admin",
  rezervace: "/admin/rezervace",
  "volne-terminy": "/admin/volne-terminy",
  vouchery: "/admin/vouchery",
  klienti: "/admin/klienti",
  media: "/admin/media",
  sluzby: "/admin/sluzby",
  "kategorie-sluzeb": "/admin/kategorie-sluzeb",
} satisfies Record<SharedAdminSectionSlug, string>;

const salonSectionPaths = {
  overview: "/admin/provoz",
  rezervace: "/admin/provoz/rezervace",
  "volne-terminy": "/admin/provoz/volne-terminy",
  vouchery: "/admin/provoz/vouchery",
  klienti: "/admin/provoz/klienti",
  media: "/admin/provoz/media",
  sluzby: "/admin/provoz/sluzby",
  "kategorie-sluzeb": "/admin/provoz/kategorie-sluzeb",
} satisfies Record<SharedAdminSectionSlug, string>;

export function getAdminSectionPath(area: AdminArea, section: SharedAdminSectionSlug) {
  return area === "owner" ? ownerSectionPaths[section] : salonSectionPaths[section];
}

export function getAdminBasePath(area: AdminArea) {
  return getAdminSectionPath(area, "overview");
}
