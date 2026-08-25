"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import * as Dialog from "@/components/ui/dialog";
import { canCloseAdminDetail } from "@/features/admin/lib/admin-form-dirty-state";

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
          const hasUnsavedChanges = Boolean(document.querySelector('[data-unsaved-changes="true"]'));
          const canClose = canCloseAdminDetail(hasUnsavedChanges, () =>
            window.confirm("Máte neuložené změny. Opravdu chcete detail zavřít a změny zahodit?"),
          );

          if (!canClose) return;
          router.push(href);
        }
      }}
    >
      {children}
    </Dialog.Root>
  );
}
