"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

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
