import { Container } from "@/components/ui/container";

type CancellationPageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function CancellationPage({ params }: CancellationPageProps) {
  const { token } = await params;

  return (
    <div className="py-16 sm:py-20">
      <Container>
        <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-8 shadow-[var(--shadow-panel)]">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
            Storno odkaz
          </p>
          <h1 className="mt-5 font-display text-4xl text-[var(--color-foreground)]">
            Struktura storna je připravená pro navazující iteraci.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-muted)]">
            Tento odkaz už používá produkční tokenizovaný tvar. Samotné zpracování storna bude navázané
            v další iteraci nad `BookingActionToken`.
          </p>
          <p className="mt-6 text-sm text-[var(--color-muted)]">Token: {token.slice(0, 10)}...</p>
        </section>
      </Container>
    </div>
  );
}
