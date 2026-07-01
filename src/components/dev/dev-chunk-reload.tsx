import Script from "next/script";

const DEV_CHUNK_RELOAD_SCRIPT = `
(() => {
  if (typeof window === "undefined") {
    return;
  }

  const reloadKey = "ppstudio:dev-chunk-reload";

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

  const reloadOnce = () => {
    try {
      if (window.sessionStorage.getItem(reloadKey) === "1") {
        return;
      }

      window.sessionStorage.setItem(reloadKey, "1");
    } catch {
      return;
    }

    window.location.reload();
  };

  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadLike(event.reason)) {
      reloadOnce();
    }
  });

  window.addEventListener(
    "error",
    (event) => {
      if (isChunkLoadLike(event.error) || isChunkLoadLike(event.target)) {
        reloadOnce();
      }
    },
    true,
  );

  window.addEventListener("pageshow", () => {
    try {
      window.sessionStorage.removeItem(reloadKey);
    } catch {}
  });
})();
`;

export function DevChunkReload() {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    // Next.js 16 docs explicitly allow beforeInteractive scripts in app/layout.tsx.
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script
      id="ppstudio-dev-chunk-reload"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: DEV_CHUNK_RELOAD_SCRIPT }}
    />
  );
}
