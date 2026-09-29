"use client";

import { useState } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

export function AdminVoucherTemplatePreview({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = Boolean(src && failedSrc === src);

  if (failed || !src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "flex aspect-[840/410] items-center justify-center rounded-lg border border-dashed border-white/12 bg-white/[0.03] px-4 text-center text-xs text-white/48",
          className,
        )}
      >
        Náhled šablony není dostupný.
      </div>
    );
  }

  return (
    <div className={cn("relative aspect-[216/105] w-full overflow-hidden", className)}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 768px) 60vw, 100vw"
        unoptimized
        className="object-contain"
        onError={() => setFailedSrc(src)}
      />
    </div>
  );
}
