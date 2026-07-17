"use client";

import { useEffect, useState } from "react";

export function AdminOfflineBanner() {
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setMounted(true);

    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);
    setIsOnline(navigator.onLine);
    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);
    return () => {
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);

  // SSR and the initial client render must match; browser state is read only after mount.
  if (!mounted || isOnline) return null;

  return (
    <div role="status" className="border-b border-amber-200/20 bg-amber-100 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-center text-sm font-medium text-stone-950">
      Jste offline. Změny rezervací nejsou dostupné.
    </div>
  );
}
