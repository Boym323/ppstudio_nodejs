"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode, type RefObject } from "react";

import * as Dialog from "@/components/ui/dialog";

/** Sdílený Radix lifecycle pro drawery, jejichž otevřený stav určuje URL. */
export function AdminRouteDrawer({
  href,
  children,
  desktopOnly = false,
}: {
  href: string;
  children: ReactNode;
  desktopOnly?: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(!desktopOnly);

  useEffect(() => {
    if (!desktopOnly) {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 1280px)");
    const updateEnabled = () => setEnabled(mediaQuery.matches);
    updateEnabled();
    mediaQuery.addEventListener("change", updateEnabled);

    return () => mediaQuery.removeEventListener("change", updateEnabled);
  }, [desktopOnly]);

  return (
    <Dialog.Root
      open={enabled}
      onOpenChange={(nextOpen) => {
        if (enabled && !nextOpen) {
          router.push(href);
        }
      }}
    >
      {children}
    </Dialog.Root>
  );
}

export function AdminEscapeKeyClose({
  onEscape,
  enabled = true,
}: {
  onEscape: () => void;
  enabled?: boolean;
}) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      onEscape();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, onEscape]);

  return null;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Udrží klávesový fokus v otevřeném modálním panelu a umožní jej zavřít Esc. */
export function useAdminModalFocus({
  open,
  containerRef,
  initialFocusRef,
  onClose,
}: {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const focusInitialElement = () => {
      const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
      (initialFocusRef?.current ?? focusable[0])?.focus();
    };
    const frame = window.requestAnimationFrame(focusInitialElement);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
        .filter((element) => !element.hasAttribute("hidden"));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [containerRef, initialFocusRef, onClose, open]);
}
