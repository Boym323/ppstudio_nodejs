"use client";

import { ObfuscatedEmailLink } from "@/components/ui/obfuscated-email-link";
import { formatBookingCalendarDate, formatBookingTimeRange } from "@/features/booking/lib/booking-format";
import { formatObfuscatedEmail } from "@/lib/email-obfuscation";

type BookingConfirmationPanelProps = {
  confirmation: {
    serviceName: string;
    scheduledStartsAt: string;
    scheduledEndsAt: string;
    clientName: string;
    manageReservationUrl: string;
    cancellationUrl: string;
  };
  salonContact: {
    name: string;
    email: string;
    phone: string;
  };
};

export function BookingConfirmationPanel({
  confirmation,
  salonContact,
}: BookingConfirmationPanelProps) {
  const scheduledStartsAt = new Date(confirmation.scheduledStartsAt);
  const scheduledEndsAt = new Date(confirmation.scheduledEndsAt);
  const calendarDate = formatBookingCalendarDate(scheduledStartsAt);
  const timeRange = formatBookingTimeRange(scheduledStartsAt, scheduledEndsAt);

  return (
    <section className="space-y-5 sm:space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-[var(--color-accent-soft)]/45 bg-[linear-gradient(135deg,rgba(34,22,18,0.98),rgba(57,41,34,0.92))] p-7 text-white shadow-[0_24px_70px_rgba(23,15,11,0.24)] sm:p-9">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[rgba(232,213,192,0.14)] blur-3xl" />
        <div className="absolute left-[-3rem] top-12 h-28 w-28 rounded-full bg-white/6 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[rgba(232,213,192,0.76)]">
              PP Studio
            </p>
            <h1 className="mt-4 font-display text-4xl leading-tight text-white sm:text-[2.8rem]">
              Rezervace přijata
            </h1>
            <p className="mt-3 max-w-xl text-base leading-7 text-white/74 sm:text-[1.02rem]">
              Vaši rezervaci jsme přijali ke schválení.
            </p>
          </div>
          <div className="inline-flex items-center gap-3 self-start rounded-full border border-white/12 bg-white/8 px-4 py-3 text-sm text-white/84 backdrop-blur">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/10 text-[#f4e6d7]">
              <SuccessIcon />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/56">
                Stav rezervace
              </p>
              <p className="mt-1 font-medium text-white">Čeká na potvrzení</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-[var(--color-accent-soft)]/35 bg-white p-7 shadow-[var(--shadow-panel)] sm:p-9">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
              Služba
            </p>
            <p className="mt-3 text-xl font-semibold tracking-[-0.02em] text-[var(--color-foreground)] sm:text-[1.35rem]">
              {confirmation.serviceName}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
              Termín
            </p>
            <p className="mt-3 font-display text-3xl leading-tight text-[var(--color-foreground)] sm:text-[2.7rem]">
              {calendarDate}
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-[var(--color-foreground)] sm:text-[2.15rem]">
              {timeRange}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-black/6 bg-[var(--color-surface)]/32 p-6 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
          Co bude následovat
        </p>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--color-foreground)]/82">
          Potvrzení přijde dalším e-mailem a kdyby bylo potřeba něco upřesnit, ozveme se.
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-black/6 bg-white p-6 shadow-[var(--shadow-panel)] sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap">
          <a
            href={confirmation.manageReservationUrl}
            className="inline-flex min-h-13 flex-1 items-center justify-center rounded-full bg-[var(--color-foreground)] px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-[#2c221d] sm:text-sm"
          >
            Změnit termín
          </a>
          <a
            href={confirmation.cancellationUrl}
            className="inline-flex min-h-13 flex-1 items-center justify-center rounded-full border border-red-200 bg-red-50 px-6 py-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-red-700 transition hover:border-red-300 hover:bg-red-100 sm:text-sm"
          >
            Zrušit rezervaci
          </a>
        </div>
        <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">
          Rezervaci můžete pohodlně přesunout na jiný volný termín, případně ji zrušit.
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-black/6 bg-white p-6 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
          Potřebujete pomoc?
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <ObfuscatedEmailLink
            email={salonContact.email}
            ariaLabel="Napsat e-mail do studia"
            className="inline-flex min-h-11 items-center gap-3 rounded-full border border-black/10 bg-[var(--color-surface)]/45 px-4 py-2 text-[15px] font-medium text-[var(--color-foreground)] transition hover:border-black/20 hover:bg-white"
          >
            <MailIcon />
            {formatObfuscatedEmail(salonContact.email)}
          </ObfuscatedEmailLink>
          <a
            href={`tel:${salonContact.phone}`}
            className="inline-flex min-h-11 items-center gap-3 rounded-full border border-black/10 bg-[var(--color-surface)]/45 px-4 py-2 text-[15px] font-medium text-[var(--color-foreground)] transition hover:border-black/20 hover:bg-white"
          >
            <PhoneIcon />
            {salonContact.phone}
          </a>
        </div>
      </section>
    </section>
  );
}

function SuccessIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M4.5 9.2 7.35 12 13.5 5.85"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="9" r="7.1" stroke="currentColor" strokeWidth="1.2" opacity="0.52" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M3 5.25A1.75 1.75 0 0 1 4.75 3.5h8.5A1.75 1.75 0 0 1 15 5.25v7.5a1.75 1.75 0 0 1-1.75 1.75h-8.5A1.75 1.75 0 0 1 3 12.75v-7.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="m4 5 4.25 3.4a1.2 1.2 0 0 0 1.5 0L14 5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M5.245 3.75h2.01c.29 0 .554.167.678.43l.9 1.9a.75.75 0 0 1-.096.79l-.85 1.06a10.8 10.8 0 0 0 2.18 2.183l1.062-.85a.75.75 0 0 1 .79-.095l1.9.9a.75.75 0 0 1 .431.677v2.01a.75.75 0 0 1-.675.747 9.98 9.98 0 0 1-4.215-.562 10.76 10.76 0 0 1-3.458-2.305A10.76 10.76 0 0 1 3.56 8.08a9.98 9.98 0 0 1-.562-4.215.75.75 0 0 1 .747-.675Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
