"use client";

import Image from "next/image";
import { useState } from "react";

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
  const [failed, setFailed] = useState(false);

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

  return <Image src={src} alt={alt} width={840} height={410} className={className} onError={() => setFailed(true)} />;
}
