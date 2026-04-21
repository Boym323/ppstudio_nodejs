"use client";

import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

type StickyCTAProps = {
  disabled?: boolean;
  label: string;
  note: string;
  onClick?: () => void;
  type?: "button" | "submit";
};

export function StickyCTA({
  disabled = false,
  label,
  note,
  onClick,
  type = "button",
}: StickyCTAProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/8 bg-white/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--color-foreground)]">{label}</p>
          <p className="truncate text-xs text-[var(--color-muted)]">{note}</p>
        </div>
        <button
          type={type}
          onClick={onClick}
          disabled={isDisabled}
          className={cn(
            "inline-flex min-h-12 shrink-0 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold uppercase tracking-[0.16em]",
            type === "submit"
              ? "bg-[var(--color-accent)] text-[var(--color-accent-contrast)]"
              : "border border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-contrast)]",
            isDisabled ? "cursor-not-allowed opacity-60" : "",
          )}
        >
          {pending && type === "submit" ? "Odesílám..." : label}
        </button>
      </div>
    </div>
  );
}
