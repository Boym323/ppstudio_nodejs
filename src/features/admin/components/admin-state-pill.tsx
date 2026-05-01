import { cn } from "@/lib/utils";

type AdminStateTone = "active" | "muted" | "accent" | "warning";

const toneStyles: Record<AdminStateTone, string> = {
  active: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
  muted: "border-white/10 bg-black/10 text-white/58",
  accent: "border-[var(--color-accent)]/40 bg-[rgba(190,160,120,0.12)] text-[var(--color-accent-soft)]",
  warning: "border-rose-300/30 bg-rose-400/10 text-rose-100",
};

export function AdminStatePill({
  tone,
  children,
  className,
  title,
}: {
  tone: AdminStateTone;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span className={cn("relative inline-flex", title ? "group" : undefined)}>
      <span
        className={cn(
          "inline-flex rounded-full border px-3 py-1 text-xs font-medium tracking-[0.01em]",
          title ? "cursor-help" : undefined,
          toneStyles[tone],
          className,
        )}
        aria-label={title}
        tabIndex={title ? 0 : undefined}
      >
        {children}
      </span>

      {title ? (
        <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-64 -translate-x-1/2 rounded-[0.9rem] border border-white/10 bg-[#171419] px-3 py-2 text-left text-[12px] normal-case tracking-normal text-white/84 shadow-[0_18px_40px_rgba(0,0,0,0.35)] group-hover:block group-focus-within:block">
          {title}
        </span>
      ) : null}
    </span>
  );
}
