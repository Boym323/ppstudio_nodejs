"use client";

import { type ReactNode, useActionState } from "react";

import {
  initialBookingEmailActionActionState,
} from "@/features/booking/actions/booking-email-action-state";
import { performBookingEmailActionAction } from "@/features/booking/actions/perform-booking-email-action";
import type { BookingEmailActionIntent } from "@/features/booking/lib/booking-action-tokens";
import type { BookingEmailActionPageState } from "@/features/booking/lib/booking-email-actions";

type BookingEmailActionPanelProps = {
  token: string;
  intent: BookingEmailActionIntent;
  initialState: BookingEmailActionPageState;
};

function StatusCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-8 shadow-[var(--shadow-panel)]">
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
        {eyebrow}
      </p>
      <h1 className="mt-5 font-display text-4xl text-[var(--color-foreground)]">{title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-muted)]">{description}</p>
      {children ? <div className="mt-8">{children}</div> : null}
    </section>
  );
}

function SummaryGrid({
  serviceName,
  clientName,
  scheduledAtLabel,
  currentStatusLabel,
}: {
  serviceName?: string;
  clientName?: string;
  scheduledAtLabel?: string;
  currentStatusLabel?: string;
}) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/45 p-5">
        <dt className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Aktuální stav</dt>
        <dd className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">{currentStatusLabel}</dd>
      </div>
      <div className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/45 p-5">
        <dt className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Služba</dt>
        <dd className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">{serviceName}</dd>
      </div>
      <div className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/45 p-5">
        <dt className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Klientka</dt>
        <dd className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">{clientName}</dd>
      </div>
      <div className="rounded-3xl border border-black/6 bg-[var(--color-surface)]/45 p-5 sm:col-span-2">
        <dt className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">Termín</dt>
        <dd className="mt-2 text-lg font-semibold text-[var(--color-foreground)]">{scheduledAtLabel}</dd>
      </div>
    </dl>
  );
}

function ActionLinks({
  adminDetailUrl,
  adminOverviewUrl,
}: {
  adminDetailUrl?: string;
  adminOverviewUrl?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <a
        href={adminDetailUrl ?? "/admin"}
        className="inline-flex min-h-13 items-center justify-center rounded-full bg-[var(--color-foreground)] px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white hover:bg-[#2c221d] sm:text-sm"
      >
        Otevřít administraci
      </a>
      <a
        href={adminOverviewUrl ?? "/admin"}
        className="inline-flex min-h-13 items-center justify-center rounded-full border border-black/10 bg-white/75 px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground)] hover:border-black/20 hover:bg-white sm:text-sm"
      >
        Zpět na přehled
      </a>
    </div>
  );
}

export function BookingEmailActionPanel({
  token,
  intent,
  initialState,
}: BookingEmailActionPanelProps) {
  const [serverState, formAction] = useActionState(
    performBookingEmailActionAction,
    initialBookingEmailActionActionState,
  );

  if (serverState.result) {
    if (serverState.result.status === "completed") {
      return (
        <StatusCard
          eyebrow={intent === "approve" ? "Schválení rezervace" : "Zrušení rezervace"}
          title={serverState.result.resultTitle}
          description={serverState.result.resultDescription}
        >
          <SummaryGrid {...serverState.result} />
          <p className="mt-6 text-sm leading-7 text-[var(--color-muted)]">
            {serverState.result.emailDeliveryStatus === "queued"
              ? "E-mail pro klientku je zařazený do odeslání na pozadí."
              : "E-mail pro klientku je zapsaný v log režimu doručování."}
          </p>
          <div className="mt-8">
            <ActionLinks
              adminDetailUrl={serverState.result.adminDetailUrl}
              adminOverviewUrl={serverState.result.adminOverviewUrl}
            />
          </div>
        </StatusCard>
      );
    }

    return (
      <StatusCard
        eyebrow={intent === "approve" ? "Schválení rezervace" : "Zrušení rezervace"}
        title={serverState.result.title}
        description={serverState.result.message}
      >
        <SummaryGrid {...serverState.result} />
        <div className="mt-8">
          <ActionLinks
            adminDetailUrl={serverState.result.adminDetailUrl}
            adminOverviewUrl={serverState.result.adminOverviewUrl}
          />
        </div>
      </StatusCard>
    );
  }

  if (initialState.status !== "ready") {
    return (
      <StatusCard
        eyebrow={intent === "approve" ? "Schválení rezervace" : "Zrušení rezervace"}
        title={initialState.title}
        description={initialState.message}
      >
        <SummaryGrid {...initialState} />
        <div className="mt-8">
          <ActionLinks
            adminDetailUrl={initialState.adminDetailUrl}
            adminOverviewUrl={initialState.adminOverviewUrl}
          />
        </div>
      </StatusCard>
    );
  }

  return (
    <section className="rounded-[var(--radius-panel)] border border-black/6 bg-white p-8 shadow-[var(--shadow-panel)]">
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-accent)]">
        {initialState.actionLabel}
      </p>
      <h1 className="mt-5 font-display text-4xl text-[var(--color-foreground)]">
        {initialState.actionQuestion}
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--color-muted)]">
        Nejdřív si zkontrolujte detaily rezervace. Finální změna proběhne až po potvrzení níže.
      </p>

      <div className="mt-8">
        <SummaryGrid {...initialState} />
      </div>

      <p className="mt-6 text-sm leading-7 text-[var(--color-muted)]">
        Platnost odkazu končí {new Date(initialState.expiresAt).toLocaleString("cs-CZ")}.
      </p>

      {serverState.status === "error" && serverState.formError ? (
        <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {serverState.formError}
        </div>
      ) : null}

      <form action={formAction} className="mt-8 flex flex-col gap-3 sm:flex-row">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="intent" value={intent} />
        <button
          type="submit"
          className={`inline-flex min-h-13 items-center justify-center rounded-full px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white sm:text-sm ${
            intent === "approve"
              ? "bg-[var(--color-foreground)] hover:bg-[#2c221d]"
              : "bg-[#9d392c] hover:bg-[#832f24]"
          }`}
        >
          {initialState.confirmLabel}
        </button>
        <a
          href={initialState.adminDetailUrl}
          className="inline-flex min-h-13 items-center justify-center rounded-full border border-black/10 bg-white/75 px-7 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground)] hover:border-black/20 hover:bg-white sm:text-sm"
        >
          Otevřít v administraci
        </a>
      </form>
    </section>
  );
}
