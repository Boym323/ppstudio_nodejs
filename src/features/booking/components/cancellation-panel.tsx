"use client";

import { useActionState, useEffect, useRef } from "react";

import { cancelPublicBookingAction } from "@/features/booking/actions/cancel-public-booking";
import { initialCancelPublicBookingActionState } from "@/features/booking/actions/cancel-public-booking-action-state";
import { ensureMatomoTrackingPath, trackMatomoEvent } from "@/features/analytics/matomo";
import type { PublicCancellationPageState } from "@/features/booking/lib/booking-cancellation";

type CancellationPanelProps = {
  token: string;
  initialState: PublicCancellationPageState;
};

function StatusCard({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-8 shadow-[var(--shadow-panel)]">
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
        {eyebrow}
      </p>
      <h1 className="mt-5 font-display text-4xl text-[var(--color-foreground)]">{title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-muted)]">{description}</p>
    </section>
  );
}

export function CancellationPanel({ token, initialState }: CancellationPanelProps) {
  const [serverState, formAction] = useActionState(
    cancelPublicBookingAction,
    initialCancelPublicBookingActionState,
  );
  const cancellationSubmittedTrackedRef = useRef(false);
  const cancellationCompletedTrackedRef = useRef(false);

  useEffect(() => {
    ensureMatomoTrackingPath("/rezervace/storno/[token]");
  }, []);

  useEffect(() => {
    if (serverState.status === "error") {
      cancellationSubmittedTrackedRef.current = false;
    }
  }, [serverState.status]);

  useEffect(() => {
    if (
      serverState.status !== "success" ||
      !serverState.result ||
      cancellationCompletedTrackedRef.current
    ) {
      return;
    }

    cancellationCompletedTrackedRef.current = true;
    trackMatomoEvent("Rezervace", "Storno dokončeno", serverState.result.serviceName);
  }, [serverState.result, serverState.status]);

  if (serverState.status === "success" && serverState.result) {
    return (
      <StatusCard
        eyebrow="Rezervace zrušena"
        title={`Hotovo, ${serverState.result.clientName}.`}
        description="Rezervace byla úspěšně zrušená a potvrzovací e-mail je zařazený do zpracování na pozadí."
      />
    );
  }

  if (initialState.status !== "ready") {
    return (
      <StatusCard
        eyebrow="Storno odkaz"
        title="Tuhle rezervaci už nelze zrušit online."
        description={initialState.message}
      />
    );
  }

  return (
    <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-8 shadow-[var(--shadow-panel)]">
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
        Storno rezervace
      </p>
      <h1 className="mt-5 font-display text-4xl text-[var(--color-foreground)]">
        Opravdu chcete zrušit rezervaci?
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-muted)]">
        Po potvrzení se termín uvolní pro další rezervaci a klientský záznam dostane auditní stopu
        o storno akci.
      </p>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/45 p-5">
          <dt className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Služba</dt>
          <dd className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">
            {initialState.serviceName}
          </dd>
        </div>
        <div className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/45 p-5">
          <dt className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Termín</dt>
          <dd className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">
            {initialState.scheduledAtLabel}
          </dd>
        </div>
      </dl>

      {serverState.status === "error" && serverState.formError ? (
        <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverState.formError}
        </div>
      ) : null}

      <form
        action={formAction}
        className="mt-8 flex flex-col gap-3 sm:flex-row"
        onSubmitCapture={() => {
          if (cancellationSubmittedTrackedRef.current) {
            return;
          }

          cancellationSubmittedTrackedRef.current = true;
          trackMatomoEvent("Rezervace", "Storno odesláno", initialState.serviceName);
        }}
      >
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="inline-flex min-h-13 items-center justify-center rounded-full bg-[var(--color-foreground)] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#2c221d] sm:text-sm"
        >
          Potvrdit storno
        </button>
        <a
          href="/rezervace"
          className="inline-flex min-h-13 items-center justify-center rounded-full border border-black/10 bg-white/75 px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground)] hover:border-black/20 hover:bg-white sm:text-sm"
        >
          Zpět na rezervaci
        </a>
      </form>
    </section>
  );
}
