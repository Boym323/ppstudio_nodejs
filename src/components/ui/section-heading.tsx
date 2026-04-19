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
      <p className="text-eyebrow text-[var(--color-accent)]">
        {eyebrow}
      </p>
      <div className="space-y-4">
        <h2 className="heading-section text-[var(--color-foreground)]">
          {title}
        </h2>
        {description ? (
          <p className="text-body max-w-2xl text-[var(--color-muted)]">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
