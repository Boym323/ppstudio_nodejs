"use client";

import { useEffect } from "react";

export function AdminDrawerEscapeClose({ href }: { href: string }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      window.location.assign(href);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [href]);

  return null;
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
