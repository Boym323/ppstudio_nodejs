import { Container } from "@/components/ui/container";

export default function ReservationLoading() {
  return (
    <div className="py-16 sm:py-20">
      <Container>
        <div className="space-y-5 sm:space-y-6">
          <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-8">
            <div className="h-4 w-32 animate-pulse rounded-full bg-[var(--color-surface-strong)]/60" />
            <div className="mt-5 h-10 w-full max-w-xl animate-pulse rounded-2xl bg-[var(--color-surface-strong)]/60" />
            <div className="mt-4 h-5 w-full max-w-2xl animate-pulse rounded-full bg-[var(--color-surface)]" />
          </section>

          <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6">
            <div className="h-4 w-40 animate-pulse rounded-full bg-[var(--color-surface-strong)]/60" />
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="h-14 animate-pulse rounded-2xl bg-[var(--color-surface)]" />
              <div className="h-14 animate-pulse rounded-2xl bg-[var(--color-surface)]" />
              <div className="h-14 animate-pulse rounded-2xl bg-[var(--color-surface)]" />
              <div className="h-14 animate-pulse rounded-2xl bg-[var(--color-surface)]" />
            </div>
          </section>

          <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-8">
            <div className="h-4 w-44 animate-pulse rounded-full bg-[var(--color-surface-strong)]/60" />
            <div className="mt-5 grid gap-4">
              <div className="h-28 animate-pulse rounded-3xl bg-[var(--color-surface)]" />
              <div className="h-28 animate-pulse rounded-3xl bg-[var(--color-surface)]" />
            </div>
            <div className="mt-8 h-72 animate-pulse rounded-3xl bg-[var(--color-surface)]" />
            <div className="mt-6 h-28 animate-pulse rounded-3xl bg-[var(--color-surface)]" />
          </section>
        </div>
      </Container>
    </div>
  );
}
