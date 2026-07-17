"use client";

import { useEffect, useState } from "react";

function getOnlineState() {
  return typeof navigator === "undefined" || navigator.onLine;
}

export function AdminOfflineBanner() {
  const [isOnline, setIsOnline] = useState(getOnlineState);

  useEffect(() => {
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);
    window.addEventListener("online", setOnline);
    window.addEventListener("offline", setOffline);
    return () => {
      window.removeEventListener("online", setOnline);
      window.removeEventListener("offline", setOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div role="status" className="border-b border-amber-200/20 bg-amber-100 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-center text-sm font-medium text-stone-950">
      Jste offline. Změny rezervací nejsou dostupné.
    </div>
  );
}
