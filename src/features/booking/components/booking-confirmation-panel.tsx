"use client";

import { ObfuscatedEmailLink } from "@/components/ui/obfuscated-email-link";
import { formatBookingCalendarDate, formatBookingTimeRange } from "@/features/booking/lib/booking-format";

type BookingConfirmationPanelProps = {
  confirmation: {
    serviceName: string;
    scheduledStartsAt: string;
    scheduledEndsAt: string;
    intendedVoucherCode?: string;
    intendedVoucherType?: "VALUE" | "SERVICE";
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
  const timeRange = formatBookingTimeRange(scheduledStartsAt, scheduledEndsAt).replace("–", " – ");
  const phoneHref = `tel:${salonContact.phone.replace(/[^\d+]/g, "")}`;

  return (
    <section className="space-y-4 sm:space-y-5">
      <section className="relative overflow-hidden rounded-[1.5rem] border border-[var(--color-accent-soft)]/45 bg-[linear-gradient(135deg,rgba(34,22,18,0.98),rgba(57,41,34,0.92))] p-5 text-white shadow-[0_20px_56px_rgba(23,15,11,0.22)] sm:p-6">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[rgba(232,213,192,0.14)] blur-3xl" />
        <div className="absolute left-[-3rem] top-8 h-24 w-24 rounded-full bg-white/6 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[rgba(232,213,192,0.76)]">
              PP Studio
            </p>
            <h1 className="mt-3 font-display text-[2rem] leading-tight text-white sm:text-[2.35rem]">
              Rezervace přijata
            </h1>
            <p className="mt-2 max-w-xl text-[0.96rem] leading-6 text-white/74">
              Rezervaci jsme přijali a termín je pro vás předběžně rezervovaný.
            </p>
          </div>
          <div className="inline-flex items-center gap-2.5 self-start rounded-full border border-[#f4e6d7]/28 bg-[#f4e6d7]/12 px-3.5 py-2 text-sm text-white/88 backdrop-blur sm:mt-0.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#f4e6d7]/24 bg-[#f4e6d7]/14 text-[#f4e6d7]">
              <SuccessIcon />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/56">
                Stav rezervace
              </p>
              <p className="font-medium text-white">Čeká na finální potvrzení</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-[var(--color-accent-soft)]/35 bg-white p-5 shadow-[var(--shadow-panel)] sm:p-6">
        <div className="space-y-4">
          <div>
            <p className="text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">Služba</p>
            <p className="mt-1.5 text-lg font-semibold text-[var(--color-foreground)] sm:text-[1.25rem]">
              {confirmation.serviceName}
            </p>
          </div>
          <div>
            <p className="text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">Termín</p>
            <p className="mt-1.5 text-base text-[var(--color-foreground)] sm:text-[1.02rem]">
              <span>{calendarDate}</span>
              <span className="px-1.5 text-[var(--color-muted)]">·</span>
              <span className="text-lg font-semibold text-[var(--color-foreground)] sm:text-[1.2rem]">{timeRange}</span>
            </p>
          </div>
          {confirmation.intendedVoucherCode ? (
            <div className="border-t border-black/6 pt-3">
              <p className="text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-accent)]">Dárkový poukaz</p>
              <p className="mt-1.5 font-mono text-base font-semibold text-[var(--color-foreground)]">
                {confirmation.intendedVoucherCode}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-[var(--color-muted)]">
                {confirmation.intendedVoucherType === "SERVICE"
                  ? "Voucher je platný pro vybranou službu. Poukaz bude uplatněn při návštěvě v salonu."
                  : "Voucher je platný. Poukaz bude uplatněn při návštěvě v salonu. Případný rozdíl doplatíte na místě."}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-black/6 bg-[var(--color-surface)]/32 p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
          Co bude následovat
        </p>
        <div className="mt-2.5 max-w-2xl space-y-1 text-[0.95rem] leading-6 text-[var(--color-foreground)]/82">
          <p>Potvrzení vám zašleme e-mailem.</p>
          <p>Pokud bude potřeba něco upřesnit, ozveme se.</p>
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-[var(--color-accent-soft)]/35 bg-white p-4 shadow-[var(--shadow-panel)] sm:p-5">
        <p className="max-w-2xl text-[0.95rem] font-medium leading-6 text-[var(--color-foreground)]">
          Termín je pro vás nyní rezervovaný a není potřeba dělat žádné další kroky.
        </p>
      </section>

      <section className="rounded-[1.25rem] border border-black/6 bg-white p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
          Potřebujete pomoc?
        </p>
        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <ObfuscatedEmailLink
            email={salonContact.email}
            ariaLabel="Napsat e-mail do studia"
            className="inline-flex min-h-11 items-center justify-center gap-2.5 rounded-full border border-black/10 bg-[var(--color-surface)]/45 px-4 py-2 text-[0.94rem] font-medium text-[var(--color-foreground)] transition hover:border-black/20 hover:bg-white sm:min-h-10 sm:bg-transparent sm:px-0 sm:py-0 sm:hover:bg-transparent"
          >
            <MailIcon />
            {salonContact.email}
          </ObfuscatedEmailLink>
          <span className="hidden text-[var(--color-muted)] sm:inline" aria-hidden="true">
            ·
          </span>
          <a
            href={phoneHref}
            className="inline-flex min-h-11 items-center justify-center gap-2.5 rounded-full border border-black/10 bg-[var(--color-surface)]/45 px-4 py-2 text-[0.94rem] font-medium text-[var(--color-foreground)] transition hover:border-black/20 hover:bg-white sm:min-h-10 sm:bg-transparent sm:px-0 sm:py-0 sm:hover:bg-transparent"
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
