export const mainNavigation = [
  { href: "/", label: "Domů" },
  { href: "/rezervace", label: "Rezervace" },
  { href: "/admin/prihlaseni", label: "Admin" },
] as const;

export const adminNavigation = [
  { href: "/admin", label: "Owner přehled" },
  { href: "/admin/provoz", label: "Provoz salonu" },
] as const;
