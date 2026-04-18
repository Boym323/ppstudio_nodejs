import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "space-y-3",
        align === "center" && "mx-auto max-w-3xl text-center",
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
        {eyebrow}
      </p>
      <div className="space-y-4">
        <h2 className="font-display text-3xl leading-[1.06] tracking-tight text-[var(--color-foreground)] sm:text-4xl lg:text-5xl">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-[15px] leading-7 text-[var(--color-muted)] sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
