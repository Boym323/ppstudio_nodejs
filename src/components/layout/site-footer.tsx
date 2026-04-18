import { siteConfig } from "@/config/site";

import { Container } from "../ui/container";

export function SiteFooter() {
  return (
    <footer className="border-t border-black/5 bg-[var(--color-surface)]">
      <Container className="flex flex-col gap-4 py-10 text-sm text-[var(--color-muted)] sm:flex-row sm:items-center sm:justify-between">
        <p>{siteConfig.name} • moderní kosmetický salon s důrazem na detail</p>
        <div className="flex flex-col gap-1 sm:items-end">
          <a href={`tel:${siteConfig.contact.phone}`} className="hover:text-[var(--color-foreground)]">
            {siteConfig.contact.phone}
          </a>
          <a
            href={`mailto:${siteConfig.contact.email}`}
            className="hover:text-[var(--color-foreground)]"
          >
            {siteConfig.contact.email}
          </a>
        </div>
      </Container>
    </footer>
  );
}
