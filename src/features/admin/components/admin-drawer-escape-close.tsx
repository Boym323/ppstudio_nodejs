"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AdminDrawerEscapeClose({ href }: { href: string }) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      router.push(href);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [href, router]);

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
