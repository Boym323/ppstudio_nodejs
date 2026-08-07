"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";

import { mainNavigation } from "@/config/navigation";
import { cn } from "@/lib/utils";

import { Container } from "../ui/container";

type SiteHeaderProps = {
  variant?: "public" | "booking";
  brandName?: string;
};

export function SiteHeader({ variant = "public", brandName = "PP Studio" }: SiteHeaderProps) {
  const isBookingVariant = variant === "booking";
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuId = useId();
  const headerRef = useRef<HTMLElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const closeMenu = (restoreFocus = false) => {
    setIsMenuOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => menuTriggerRef.current?.focus());
    }
  };

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const updateHeight = () => document.documentElement.style.setProperty("--site-header-height", `${Math.ceil(header.getBoundingClientRect().height)}px`);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const focusableSelector = "a[href], button:not([disabled])";
    const focusFirstMenuItem = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu(true);
        return;
      }
      if (event.key === "Tab") {
        const items = [...(menuRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])];
        if (!items.length) return;
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.cancelAnimationFrame(focusFirstMenuItem);
    };
  }, [isMenuOpen]);

  return (
    <header ref={headerRef} className={cn("sticky top-0 z-40 border-b border-black/5 bg-[color:rgba(248,243,237,0.9)] backdrop-blur-xl", isBookingVariant && "site-header--booking")}>
      <Container className="booking-header__container flex min-h-16 items-center justify-between gap-3 py-2 lg:min-h-20 lg:py-0">
        <Link href="/" className="booking-header__brand-row flex min-w-0 flex-col text-[var(--color-foreground)]" onClick={() => closeMenu()}>
          <span className="booking-header__brand-title font-display text-[1.3rem] tracking-[0.14em] sm:text-[1.45rem]">{brandName}</span>
          <span className="booking-header__brand-subtitle hidden text-[0.62rem] font-semibold tracking-[0.15em] text-[var(--color-accent)] sm:block">COSMETICS &amp; LAMINATIONS</span>
        </Link>

        {isBookingVariant ? (
          <Link href="/" className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-[var(--color-foreground)] underline underline-offset-4 hover:text-[var(--color-accent)] lg:hidden">← Zpět</Link>
        ) : (
          <div className="flex items-center gap-2 lg:hidden">
            <Link href="/rezervace?source=other" prefetch={false} className="button-text inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-foreground)] px-4 text-white hover:bg-[#2c221d]">Rezervovat</Link>
            <button ref={menuTriggerRef} type="button" aria-label={isMenuOpen ? "Zavřít menu" : "Otevřít menu"} aria-expanded={isMenuOpen} aria-controls={menuId} onClick={() => setIsMenuOpen((open) => !open)} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/60 text-[var(--color-foreground)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">
              <span aria-hidden="true" className="text-xl leading-none">{isMenuOpen ? "×" : "☰"}</span>
            </button>
          </div>
        )}

        <nav className="hidden items-center justify-center gap-3 lg:flex" aria-label="Hlavní navigace">
          {mainNavigation.map((item) => <Link key={item.href} href={item.href} className="button-text shrink-0 rounded-full px-3 py-2 tracking-[0.15em] text-[var(--color-muted)] hover:bg-white/70 hover:text-[var(--color-foreground)]">{item.label}</Link>)}
        </nav>
        <div className="hidden lg:block">
          {!isBookingVariant && <Link href="/rezervace?source=other" prefetch={false} className="button-text inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-foreground)] px-5 text-white hover:bg-[#2c221d]">Rezervovat termín</Link>}
        </div>
      </Container>

      {!isBookingVariant && isMenuOpen ? createPortal(
        <div className="fixed inset-x-0 bottom-0 top-[var(--site-header-height)] z-50 bg-black/20" onClick={() => closeMenu(true)}>
          <nav ref={menuRef} id={menuId} aria-label="Mobilní navigace" className="border-b border-black/6 bg-[#f8f3ed] px-4 py-4 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <Container className="grid gap-1 px-0">
              {mainNavigation.map((item) => <Link key={item.href} href={item.href} onClick={() => closeMenu()} className="inline-flex min-h-11 items-center rounded-2xl px-4 text-base font-medium text-[var(--color-foreground)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">{item.label}</Link>)}
            </Container>
          </nav>
        </div>,
        document.body,
      ) : null}
    </header>
  );
}
