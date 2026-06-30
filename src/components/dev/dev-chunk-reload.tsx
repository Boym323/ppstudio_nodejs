"use client";

import { useEffect } from "react";

const DEV_CHUNK_RELOAD_KEY = "ppstudio:dev-chunk-reload";

function isChunkLoadLikeError(reason: unknown) {
  if (!(reason instanceof Error)) {
    return false;
  }

  return (
    reason.name === "ChunkLoadError"
    || reason.message.includes("ChunkLoadError")
    || reason.message.includes("Failed to load chunk")
  );
}

export function DevChunkReload() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isChunkLoadLikeError(event.reason)) {
        return;
      }

      try {
        if (window.sessionStorage.getItem(DEV_CHUNK_RELOAD_KEY) === "1") {
          return;
        }

        window.sessionStorage.setItem(DEV_CHUNK_RELOAD_KEY, "1");
      } catch {
        return;
      }

      window.location.reload();
    };

    const handlePageShow = () => {
      try {
        window.sessionStorage.removeItem(DEV_CHUNK_RELOAD_KEY);
      } catch {}
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  return null;
}
