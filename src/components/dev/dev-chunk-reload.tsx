"use client";

import { useEffect } from "react";

const DEV_CHUNK_RELOAD_SCRIPT = `
(() => {
  if (typeof window === "undefined") {
    return;
  }

  const reloadStateKey = "ppstudio:dev-chunk-reload";
  const reloadSearchParam = "__ppstudio_chunk_reload";
  const maxReloadsPerWindow = 2;
  const reloadWindowMs = 15000;

  const readText = (value) => {
    if (typeof value === "string") {
      return value;
    }

    if (!value || typeof value !== "object") {
      return "";
    }

    const parts = [];

    if (typeof value.name === "string") {
      parts.push(value.name);
    }

    if (typeof value.message === "string") {
      parts.push(value.message);
    }

    if (typeof value.reason === "string") {
      parts.push(value.reason);
    }

    return parts.join(" ");
  };

  const isChunkAssetTarget = (target) => {
    if (!target || typeof target !== "object") {
      return false;
    }

    const src = typeof target.src === "string" ? target.src : "";
    const href = typeof target.href === "string" ? target.href : "";
    const url = src || href;

    return url.includes("/_next/static/chunks/");
  };

  const isChunkLoadLike = (value) => {
    if (isChunkAssetTarget(value)) {
      return true;
    }

    const text = readText(value);

    return (
      text.includes("ChunkLoadError")
      || text.includes("Failed to load chunk")
      || text.includes("/_next/static/chunks/")
    );
  };

  const readReloadState = () => {
    try {
      const raw = window.sessionStorage.getItem(reloadStateKey);

      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);

      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      if (typeof parsed.windowStartedAt !== "number" || typeof parsed.attemptCount !== "number") {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  };

  const writeReloadState = (state) => {
    try {
      window.sessionStorage.setItem(reloadStateKey, JSON.stringify(state));
    } catch {}
  };

  const clearReloadState = () => {
    try {
      window.sessionStorage.removeItem(reloadStateKey);
    } catch {}
  };

  const clearReloadSearchParam = () => {
    try {
      const url = new URL(window.location.href);

      if (!url.searchParams.has(reloadSearchParam)) {
        return;
      }

      url.searchParams.delete(reloadSearchParam);
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {}
  };

  const reloadWithGuard = () => {
    const now = Date.now();
    const state = readReloadState();
    const isFreshWindow =
      state
      && now - state.windowStartedAt >= 0
      && now - state.windowStartedAt <= reloadWindowMs;
    const nextState = isFreshWindow
      ? state
      : { windowStartedAt: now, attemptCount: 0 };

    if (nextState.attemptCount >= maxReloadsPerWindow) {
      return;
    }

    writeReloadState({
      windowStartedAt: nextState.windowStartedAt,
      attemptCount: nextState.attemptCount + 1,
    });

    try {
      const url = new URL(window.location.href);
      url.searchParams.set(reloadSearchParam, String(now));
      window.location.replace(url.toString());
      return;
    } catch {}

    window.location.reload();
  };

  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadLike(event.reason)) {
      reloadWithGuard();
    }
  });

  window.addEventListener(
    "error",
    (event) => {
      if (isChunkLoadLike(event.error) || isChunkLoadLike(event.target)) {
        reloadWithGuard();
      }
    },
    true,
  );

  window.addEventListener("pageshow", () => {
    clearReloadState();
    clearReloadSearchParam();
  });

  clearReloadSearchParam();
})();
`;

export function DevChunkReload() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || document.getElementById("ppstudio-dev-chunk-reload")) {
      return;
    }

    const script = document.createElement("script");
    script.id = "ppstudio-dev-chunk-reload";
    script.text = DEV_CHUNK_RELOAD_SCRIPT;
    document.head.append(script);
  }, []);

  return null;
}
