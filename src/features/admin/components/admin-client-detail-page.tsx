import { BookingStatus } from "@prisma/client";
import Link from "next/link";
import { type ReactNode } from "react";

import { type AdminClientDetailData } from "@/features/admin/lib/admin-clients";
import { cn } from "@/lib/utils";

import { AdminClientNoteForm } from "./admin-client-note-form";
import { AdminPanel } from "./admin-page-shell";

type AdminClientDetailPageProps = {
  data: AdminClientDetailData;
};

type ActionLinkProps = {
  href: string | null;
  children: ReactNode;
  variant?: "primary" | "secondary";
};

export function AdminClientDetailPage({ data }: AdminClientDetailPageProps) {
  return (
    <div className="min-w-0 space-y-4">
      <ClientDetailHeader data={data} />
      <ClientKpiCards data={data} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="space-y-4">
          <ClientVisitHistory data={data} />
          <ClientInternalNoteCard data={data} />
        </div>

        <aside className="space-y-4">
          <ClientContactCard data={data} />
          <ClientOverviewCard data={data} />
          <ClientProfileMetadata data={data} />
        </aside>
      </div>
    </div>
  );
}

function ClientDetailHeader({ data }: { data: AdminClientDetailData }) {
  const listHref = data.area === "owner" ? "/admin/klienti" : "/admin/provoz/klienti";
  const detailHref = data.area === "owner" ? `/admin/klienti/${data.id}` : `/admin/provoz/klienti/${data.id}`;
  const createBookingHref = buildCreateBookingHref(data.area, data.id);

  return (
    <section className="rounded-[1.25rem] border border-white/10 bg-white/6 p-4 backdrop-blur-xl sm:p-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[0.68rem] uppercase tracking-[0.28em] text-[var(--color-accent-soft)]">
              Detail klienta
            </p>
            <span className={getClientBadgeClassName(data.isActive)}>{data.statusLabel}</span>
          </div>

          <h1 className="mt-2 break-words font-display text-[1.85rem] leading-tight text-white sm:text-[2.2rem] xl:text-[2.45rem]">
            {data.fullName}
          </h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-5 text-white/70">
            {buildHeaderSubtitle(data)}
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <ActionLink href={createBookingHref} variant="primary">Vytvořit rezervaci</ActionLink>
          <ActionLink href={data.phoneHref}>Zavolat</ActionLink>
          <ActionLink href={data.emailHref}>Napsat e-mail</ActionLink>
          <ActionLink href={detailHref}>Obnovit detail</ActionLink>
        </div>
      </div>

      <div className="mt-3">
        <Link
          href={listHref}
          className="inline-flex rounded-full border border-white/10 px-3.5 py-1.5 text-sm text-white/76 transition hover:border-white/24 hover:bg-white/6 hover:text-white"
        >
          Zpět na klienty
        </Link>
      </div>
    </section>
  );
}

function ClientKpiCards({ data }: { data: AdminClientDetailData }) {
  const { crmSummary } = data;

  return (
    <section className="rounded-[1rem] border border-white/10 bg-black/10 p-3 sm:p-3.5">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[0.68rem] uppercase tracking-[0.22em] text-[var(--color-accent-soft)]">
            Souhrn klientky
          </p>
        </div>
        <span className={getClientBadgeClassName(data.isActive)}>{data.statusLabel}</span>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Poslední návštěva"
          value={
            crmSummary.lastVisit
              ? formatBookingDateLabel(crmSummary.lastVisit.scheduledStartsAt, crmSummary.lastVisit.scheduledEndsAt)
              : "Zatím žádná"
          }
          detail={crmSummary.lastVisit?.serviceName}
        />
        <KpiCard
          label="Příští návštěva"
          value={
            crmSummary.nextVisit
              ? formatBookingDateLabel(crmSummary.nextVisit.scheduledStartsAt, crmSummary.nextVisit.scheduledEndsAt)
              : "Žádná naplánovaná návštěva"
          }
          detail={crmSummary.nextVisit?.serviceName}
        />
        <KpiCard label="Hodnota služeb" value={formatCzk(crmSummary.servicesValueCzk)} />
        <KpiCard label="Uhrazeno" value={formatCzk(crmSummary.paidCzk)} tone="active" />
        <KpiCard
          label="Neuhrazeno"
          value={formatCzk(crmSummary.unpaidCzk)}
          tone={crmSummary.unpaidCzk > 0 ? "default" : "muted"}
        />
      </div>

      <p className="mt-2.5 text-xs leading-5 text-white/52">
        Rezervace celkem: {crmSummary.totalBookings} · Dokončené: {crmSummary.completedBookings} · Aktivní:{" "}
        {crmSummary.activeBookings} · Zrušené: {crmSummary.cancelledBookings} · Nedorazila:{" "}
        {crmSummary.noShowBookings}
      </p>
    </section>
  );
}

function ClientVisitHistory({ data }: { data: AdminClientDetailData }) {
  const createBookingHref = buildCreateBookingHref(data.area, data.id);

  return (
    <AdminPanel
      title="Historie návštěv"
      compact
      denseHeader
    >
      {data.bookings.length > 0 ? (
        <div className="grid gap-2">
          {data.bookings.map((booking) => (
            <article
              key={booking.id}
              className="rounded-[0.9rem] border border-white/8 bg-white/[0.045] px-3 py-2.5"
            >
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-medium text-white sm:text-[0.95rem]">{booking.serviceName}</h4>
                    <span className={getBookingBadgeClassName(booking.status)}>{booking.statusLabel}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-white/58 sm:text-sm">
                    {booking.scheduledAtLabel} · {booking.sourceLabel}
                  </p>
                  {booking.notes.length > 0 ? (
                    <div className="mt-1.5 space-y-1">
                      {booking.notes.map((note) => (
                        <p key={note.label} className="text-sm leading-5 text-white/70">
                          <span className="font-medium text-white/84">{note.label}:</span> {note.value}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>

                <Link
                  href={booking.href}
                  className="inline-flex min-h-8 items-center justify-center rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-white/78 transition hover:border-white/22 hover:bg-white/7 hover:text-white sm:text-sm"
                >
                  Otevřít detail
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[1rem] border border-dashed border-white/14 bg-white/4 p-4">
          <p className="text-sm leading-5 text-white/70">Klientka zatím nemá žádnou rezervaci.</p>
          <Link
            href={createBookingHref}
            className="mt-3 inline-flex rounded-full bg-[var(--color-accent)] px-3.5 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
          >
            Vytvořit rezervaci
          </Link>
        </div>
      )}
    </AdminPanel>
  );
}

function buildCreateBookingHref(area: AdminClientDetailData["area"], clientId: string) {
  const basePath = area === "owner" ? "/admin/rezervace" : "/admin/provoz/rezervace";
  return `${basePath}?create=1&clientId=${encodeURIComponent(clientId)}`;
}

function ClientInternalNoteCard({ data }: { data: AdminClientDetailData }) {
  return (
    <AdminPanel
      title="Interní poznámka"
      description="Viditelná pouze pro tým."
      compact
      denseHeader
    >
      <AdminClientNoteForm area={data.area} clientId={data.id} initialValue={data.internalNote} />
    </AdminPanel>
  );
}

function ClientContactCard({ data }: { data: AdminClientDetailData }) {
  return (
    <SideCard title="Kontakt">
      <div className="space-y-2.5">
        <ContactRow label="E-mail" value={data.email} href={data.emailHref} />
        <ContactRow label="Telefon" value={data.phone} href={data.phoneHref} />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <ActionLink href={data.phoneHref}>Zavolat</ActionLink>
          <ActionLink href={data.emailHref}>Napsat e-mail</ActionLink>
        </div>
      </div>
    </SideCard>
  );
}

function ClientOverviewCard({ data }: { data: AdminClientDetailData }) {
  return (
    <SideCard title="Přehled klientky">
      <dl className="space-y-2">
        <CompactMetaRow label="Rezervací celkem" value={String(data.totalBookings)} />
        <CompactMetaRow label="Nejčastější služba" value={data.favoriteServiceName} />
        <CompactMetaRow label="Budoucí termíny" value={String(data.upcomingBookings)} />
      </dl>
    </SideCard>
  );
}

function ClientProfileMetadata({ data }: { data: AdminClientDetailData }) {
  return (
    <SideCard title="Profilová metadata" muted>
      <dl className="space-y-2">
        <CompactMetaRow label="Vytvořeno" value={data.createdAtLabel} muted />
        <CompactMetaRow label="Naposledy upraveno" value={data.updatedAtLabel} muted />
      </dl>
    </SideCard>
  );
}

function KpiCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "active" | "muted";
}) {
  return (
    <article
      className={cn(
        "flex min-h-[6.25rem] flex-col rounded-[0.85rem] border px-3 py-2.5",
        tone === "active"
          ? "border-emerald-300/28 bg-emerald-400/10"
          : tone === "muted"
            ? "border-white/8 bg-white/4"
            : "border-white/10 bg-black/10",
      )}
    >
      <p className="text-[0.66rem] uppercase tracking-[0.16em] text-white/50">{label}</p>
      <p className="mt-1.5 break-words font-display text-lg leading-tight text-white sm:text-xl">{value}</p>
      {detail ? <p className="mt-auto pt-1 text-xs leading-5 text-white/56">{detail}</p> : null}
    </article>
  );
}

function SideCard({
  title,
  children,
  muted = false,
}: {
  title: string;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-[1rem] border p-3",
        muted ? "border-white/8 bg-black/8" : "border-white/10 bg-black/12",
      )}
    >
      <h3 className="font-display text-[1.05rem] leading-tight text-white">{title}</h3>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function ContactRow({ label, value, href }: { label: string; value: string; href: string | null }) {
  const content = (
    <>
      <dt className="text-[0.68rem] uppercase tracking-[0.18em] text-white/44">{label}</dt>
      <dd className="mt-1 break-words text-sm leading-5 text-white/82">{value}</dd>
    </>
  );

  if (!href) {
    return <div className="rounded-[0.85rem] border border-white/8 bg-white/5 px-3 py-2">{content}</div>;
  }

  return (
    <a
      href={href}
      className="block rounded-[0.85rem] border border-white/8 bg-white/5 px-3 py-2 transition hover:border-white/18 hover:bg-white/7"
    >
      {content}
    </a>
  );
}

function CompactMetaRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,auto)] items-center gap-3 rounded-[0.8rem] border border-white/8 bg-white/[0.035] px-3 py-2">
      <dt className="text-[0.66rem] uppercase tracking-[0.16em] text-white/42">{label}</dt>
      <dd className={cn("min-w-0 text-right text-sm leading-5", muted ? "text-white/60" : "text-white/82")}>{value}</dd>
    </div>
  );
}

function ActionLink({ href, children, variant = "secondary" }: ActionLinkProps) {
  if (!href) {
    return (
      <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-white/8 px-3.5 py-1.5 text-sm font-medium text-white/32">
        {children}
      </span>
    );
  }

  const isPrimary = variant === "primary";
  const className = isPrimary
    ? "inline-flex min-h-9 items-center justify-center rounded-full bg-[var(--color-accent)] px-3.5 py-1.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
    : "inline-flex min-h-9 items-center justify-center rounded-full border border-white/10 px-3.5 py-1.5 text-sm font-medium text-white/78 transition hover:border-white/22 hover:bg-white/7 hover:text-white";

  if (href.startsWith("mailto:") || href.startsWith("tel:")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function buildHeaderSubtitle(data: AdminClientDetailData) {
  const lastVisit = data.crmSummary.lastVisit
    ? formatBookingDateLabel(data.crmSummary.lastVisit.scheduledStartsAt, data.crmSummary.lastVisit.scheduledEndsAt)
    : "zatím bez dokončené návštěvy";
  const nextVisit = data.crmSummary.nextVisit
    ? `další termín ${formatBookingDateLabel(data.crmSummary.nextVisit.scheduledStartsAt, data.crmSummary.nextVisit.scheduledEndsAt)}`
    : "bez budoucího termínu";

  return `Poslední návštěva ${lastVisit} · ${nextVisit}`;
}

function formatBookingDateLabel(startsAt: Date, endsAt: Date) {
  return `${new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(startsAt)} - ${new Intl.DateTimeFormat("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(endsAt)}`;
}

function formatCzk(value: number) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value);
}

function getClientBadgeClassName(isActive: boolean) {
  return cn(
    "inline-flex rounded-full border px-2.5 py-0.5 text-[0.68rem] uppercase tracking-[0.16em]",
    isActive
      ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
      : "border-white/10 bg-white/8 text-white/64",
  );
}

function getBookingBadgeClassName(status: BookingStatus) {
  return cn(
    "inline-flex rounded-full border px-2 py-0.5 text-[0.64rem] uppercase tracking-[0.14em]",
    status === BookingStatus.COMPLETED
      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
      : status === BookingStatus.CONFIRMED
        ? "border-[var(--color-accent)]/40 bg-[rgba(190,160,120,0.12)] text-[var(--color-accent-soft)]"
        : status === BookingStatus.PENDING
          ? "border-amber-300/30 bg-amber-400/10 text-amber-100"
          : status === BookingStatus.NO_SHOW
            ? "border-red-300/26 bg-red-400/10 text-red-100"
            : "border-white/10 bg-white/6 text-white/58",
  );
}
