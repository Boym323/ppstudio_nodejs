export const mainNavigation = [
  { href: '/', label: 'Domů' },
  { href: '/sluzby', label: 'Služby' },
  { href: '/cenik', label: 'Ceník' },
  { href: '/o-salonu', label: 'O salonu' },
  { href: '/kontakt', label: 'Kontakt' },
] as const;

export const footerNavigation = [
  { href: '/faq', label: 'FAQ' },
  { href: '/storno-podminky', label: 'Storno podmínky' },
  { href: '/obchodni-podminky', label: 'Obchodní podmínky' },
  { href: '/gdpr', label: 'GDPR' },
] as const;

export const adminNavigation = [
  { href: '/admin', label: 'Owner přehled' },
  { href: '/admin/provoz', label: 'Provoz salonu' },
] as const;
