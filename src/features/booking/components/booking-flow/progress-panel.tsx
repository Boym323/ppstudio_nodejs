import { type PublicBookingActionState } from "@/features/booking/actions/public-booking-action-state";
import { cn } from "@/lib/utils";

type BookingProgressPanelProps = {
  currentStep: number;
  formError?: PublicBookingActionState["formError"];
  stepLabels: readonly string[];
};

export function BookingProgressPanel({
  currentStep,
  formError,
  stepLabels,
}: BookingProgressPanelProps) {
  const progressValue = Math.round((currentStep / stepLabels.length) * 100);

  return (
    <>
      <div className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/22 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
              Krok {currentStep} ze {stepLabels.length}
            </p>
            <p className="mt-2 text-sm font-medium text-[var(--color-foreground)]">
              Rezervace zabere zhruba minutu.
            </p>
          </div>
          <p className="text-sm font-semibold text-[var(--color-muted)]">{progressValue} %</p>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/6">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300"
            style={{ width: `${progressValue}%` }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
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

      {formError ? (
        <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {formError}
        </div>
      ) : null}
    </>
  );
}
