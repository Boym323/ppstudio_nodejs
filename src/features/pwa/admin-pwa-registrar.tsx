"use client";

import { useEffect } from "react";

export function AdminPwaRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/admin-sw.js", {
      scope: "/admin/",
      updateViaCache: "none",
    }).catch((error: unknown) => {
      console.error("Registrace admin PWA selhala:", error);
    });
  }, []);

  return null;
}
