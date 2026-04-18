import { Container } from "@/components/ui/container";

export default function ReservationLoading() {
  return (
    <div className="py-16 sm:py-20">
      <Container>
        <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-8 shadow-[var(--shadow-panel)]">
          <div className="h-4 w-28 animate-pulse rounded-full bg-[var(--color-surface-strong)]/60" />
          <div className="mt-5 h-10 w-full max-w-xl animate-pulse rounded-2xl bg-[var(--color-surface-strong)]/60" />
          <div className="mt-4 h-5 w-full max-w-2xl animate-pulse rounded-full bg-[var(--color-surface)]" />
          <div className="mt-8 grid gap-4">
            <div className="h-28 animate-pulse rounded-3xl bg-[var(--color-surface)]" />
            <div className="h-28 animate-pulse rounded-3xl bg-[var(--color-surface)]" />
            <div className="h-28 animate-pulse rounded-3xl bg-[var(--color-surface)]" />
          </div>
        </section>
      </Container>
    </div>
  );
}
