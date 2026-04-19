import { cn } from "@/lib/utils";

type AdminStateTone = "active" | "muted" | "accent";

const toneStyles: Record<AdminStateTone, string> = {
  active: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
  muted: "border-white/10 bg-black/10 text-white/58",
  accent: "border-[var(--color-accent)]/40 bg-[rgba(190,160,120,0.12)] text-[var(--color-accent-soft)]",
};

export function AdminStatePill({
  tone,
  children,
  className,
}: {
  tone: AdminStateTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em]",
        toneStyles[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
