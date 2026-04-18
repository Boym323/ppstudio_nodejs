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
    <div className={cn("space-y-4", align === "center" && "text-center")}>
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--color-accent)]">
        {eyebrow}
      </p>
      <div className="space-y-3">
        <h2 className="font-display text-4xl tracking-tight text-[var(--color-foreground)] sm:text-5xl">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-base leading-7 text-[var(--color-muted)]">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
