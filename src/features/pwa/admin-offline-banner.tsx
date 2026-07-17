"use client";

import { useSyncExternalStore } from "react";

function subscribeToOnlineState(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);

  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

// This snapshot is also used during hydration, so the initial SSR/client markup matches.
function getServerOnlineSnapshot() {
  return true;
}

export function AdminOfflineBanner() {
  const isOnline = useSyncExternalStore(
    subscribeToOnlineState,
    getOnlineSnapshot,
    getServerOnlineSnapshot,
  );

  if (isOnline) return null;

  return (
    <div role="status" className="border-b border-amber-200/20 bg-amber-100 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] text-center text-sm font-medium text-stone-950">
      Jste offline. Změny rezervací nejsou dostupné.
    </div>
  );
}
