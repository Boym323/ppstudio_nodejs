import { cn } from "@/lib/utils";

type BookingProgressPanelProps = {
  currentStep: number;
  stepLabels: readonly string[];
};

export function BookingProgressPanel({
  currentStep,
  stepLabels,
}: BookingProgressPanelProps) {
  const progressValue = Math.round((currentStep / stepLabels.length) * 100);

  return (
    <div className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/22 p-3 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)] sm:tracking-[0.32em]">
            <span className="sm:hidden">{currentStep} ze {stepLabels.length} · {stepLabels[currentStep - 1]}</span><span className="hidden sm:inline">Krok {currentStep} ze {stepLabels.length}</span>
          </p>
          <p className="mt-2 hidden text-sm font-medium text-[var(--color-foreground)] sm:block">
            Rezervace zabere zhruba minutu.
          </p>
        </div>
        <p className="text-sm font-semibold text-[var(--color-muted)]">{progressValue} %</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/6 sm:mt-4 sm:h-2">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300"
          style={{ width: `${progressValue}%` }}
        />
      </div>
      <div className="mt-4 hidden flex-wrap gap-2 sm:flex">
        {stepLabels.map((label, index) => {
          const stepNumber = index + 1;

          return (
            <div
              key={label}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em]",
                stepNumber <= currentStep
                  ? "border-[var(--color-accent)] bg-white text-[var(--color-foreground)]"
                  : "border-black/8 bg-[var(--color-surface)]/35 text-[var(--color-muted)]",
              )}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-surface)] text-[10px]">
                {stepNumber}
              </span>
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
