import Link from "next/link";

import { type AdminBookingDetailData, getAdminBookingHref } from "@/features/admin/lib/admin-booking";
import { cn } from "@/lib/utils";

import { AdminBookingNoteForm } from "./admin-booking-note-form";
import { AdminBookingStatusForm } from "./admin-booking-status-form";
import { AdminPanel } from "./admin-page-shell";

type AdminBookingDetailPageProps = {
  data: AdminBookingDetailData;
};

export function AdminBookingDetailPage({ data }: AdminBookingDetailPageProps) {
  const listHref = data.area === "owner" ? "/admin/rezervace" : "/admin/provoz/rezervace";
  const statusContext = getStatusContext(data);

  return (
    <div className="min-w-0 space-y-3">
      <section className="sticky top-1.5 z-20 rounded-[var(--radius-panel)] border border-white/8 bg-[rgba(11,11,11,0.88)] p-3 backdrop-blur-xl sm:p-3.5">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={listHref} className="rounded-full border border-white/8 px-3 py-1.5 text-sm text-white/76 transition hover:border-white/18 hover:text-white">
                Zpět na rezervace
              </Link>
              <span className={getStatusBadgeClassName(data.status)}>{data.statusLabel}</span>
              <span className="rounded-full border border-white/8 px-2.5 py-1 text-[0.66rem] font-medium uppercase tracking-[0.16em] text-white/50">
                {data.sourceLabel}
              </span>
            </div>

            <div className="space-y-0.5">
              <p className="text-[0.66rem] uppercase tracking-[0.22em] text-[var(--color-accent-soft)]">
                {data.area === "owner" ? "Detail rezervace" : "Detail termínu"}
              </p>
              <h1 className="font-display text-[1.48rem] leading-tight text-white sm:text-[1.72rem] xl:text-[1.9rem]">
                {data.clientName} <span className="text-white/44">•</span> {data.serviceName}
              </h1>
              <p className="text-[0.93rem] text-white/60">{data.scheduledAtLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ContactLink
              href={buildPhoneHref(data.clientPhone)}
              label="Zavolat klientce"
              value={data.clientPhone}
              compact
            />
            <ContactLink
              href={`mailto:${data.clientEmail}`}
              label="Napsat e-mail"
              value={data.clientEmail}
              compact
            />
            <Link
              href={getAdminBookingHref(data.area, data.id)}
              className="rounded-full border border-white/8 px-3 py-1.5 text-sm text-white/76 transition hover:border-white/18 hover:text-white"
            >
              Obnovit detail
            </Link>
          </div>
        </div>
      </section>

      <AdminPanel title="Souhrn rezervace" compact={data.area === "salon"} denseHeader>
        <dl className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryItem label="Stav" value={data.statusLabel} accentValue />
          <SummaryItem label="Klientka" value={data.clientName} detail={data.clientEmail} />
          <SummaryItem label="Služba" value={data.serviceName} />
          <SummaryItem label="Termín" value={data.scheduledAtLabel} />
          <SummaryItem label="Zdroj" value={data.sourceLabel} />
          <SummaryItem label="Naposledy změněno" value={data.updatedAtLabel} />
          <SummaryItem label="Vytvořeno" value={data.createdAtLabel} />
          <SummaryItem label="Telefon" value={data.clientPhone} />
        </dl>
      </AdminPanel>

      <AdminPanel
        title="Akce s rezervací"
        description="Hlavní provozní panel pro další krok s rezervací."
        compact={data.area === "salon"}
        denseHeader
      >
        <div className="space-y-2.5">
          <AdminBookingStatusForm
            area={data.area}
            bookingId={data.id}
            availableActions={data.availableActions}
          />

          <div className={getStatusContextClassName(data.status)}>
            <p className="text-sm font-medium text-white">{statusContext.title}</p>
            <p className="mt-1 text-sm leading-5 text-white/64">{statusContext.description}</p>
          </div>
        </div>
      </AdminPanel>

      <section className="grid gap-3 xl:grid-cols-2">
        <AdminPanel title="Poznámka od klientky" compact={data.area === "salon"} denseHeader>
          <NoteBlock
            label="Poznámka od klientky"
            value={data.clientNote ?? "Klientka k rezervaci nic nedopsala."}
            tone="default"
          />
        </AdminPanel>

        <AdminPanel title="Interní poznámka" compact={data.area === "salon"} denseHeader>
          <div className="space-y-2.5">
            {data.internalNote ? (
              <NoteBlock label="Aktuální interní poznámka" value={data.internalNote} tone="accent" />
            ) : (
              <div className="rounded-[1.05rem] border border-dashed border-white/12 bg-white/[0.03] p-3.5">
                <p className="text-sm font-medium text-white">Interní poznámka zatím chybí.</p>
                <p className="mt-1 text-sm leading-5 text-white/60">Přidej krátký kontext pro tým.</p>
              </div>
            )}

            <AdminBookingNoteForm
              area={data.area}
              bookingId={data.id}
              initialValue={data.internalNote ?? ""}
            />
          </div>
        </AdminPanel>
      </section>

      <AdminPanel title="Historie změn" description="Kompaktní auditní časová osa rezervace." compact={data.area === "salon"} denseHeader>
        {data.historyItems.length > 0 ? (
          <div className="grid gap-2.5">
            {data.historyItems.map((item, index) => (
              <article
                key={item.id}
                className="relative rounded-[1.05rem] border border-white/7 bg-white/[0.035] p-3.5"
              >
                <div className="absolute bottom-3 left-0 top-3 w-px bg-white/10" />
                <div className="pl-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2.5">
                    <div className="space-y-1">
                      <p className="text-[0.68rem] uppercase tracking-[0.2em] text-white/44">
                        Krok {data.historyItems.length - index}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn(getHistoryStatusBadgeClassName(item.statusLabel), "text-[0.68rem]")}>
                          {item.statusLabel}
                        </span>
                        {item.sourceLabel ? (
                          <span className="rounded-full border border-white/8 px-2.5 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-white/46">
                            {item.sourceLabel}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-white/54">
                        {item.actorLabel} • {item.createdAtLabel}
                      </p>
                    </div>
                  </div>

                  {item.reason ? (
                    <p className="mt-2.5 rounded-[0.9rem] border border-white/7 bg-black/20 px-3 py-2 text-sm leading-5 text-white/74">
                      <span className="font-medium text-white">Důvod:</span> {item.reason}
                    </p>
                  ) : null}

                  {item.note ? (
                    <p className="mt-2 rounded-[0.9rem] border border-white/7 bg-black/20 px-3 py-2 text-sm leading-5 text-white/70">
                      <span className="font-medium text-white">Poznámka:</span> {item.note}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.05rem] border border-dashed border-white/12 bg-white/4 p-3.5">
            <p className="text-sm leading-5 text-white/64">Historie změn zatím není k dispozici.</p>
          </div>
        )}
      </AdminPanel>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  detail,
  accentValue = false,
}: {
  label: string;
  value: string;
  detail?: string;
  accentValue?: boolean;
}) {
  return (
    <div className="rounded-[1.05rem] border border-white/7 bg-white/[0.035] p-3.5">
      <dt className="text-[0.68rem] uppercase tracking-[0.2em] text-white/46">{label}</dt>
      <dd
        className={cn(
          "mt-1.5 text-sm leading-5 text-white",
          accentValue && "font-medium text-[var(--color-accent-soft)]",
        )}
      >
        {value}
      </dd>
      {detail ? <p className="mt-1 text-sm leading-5 text-white/54">{detail}</p> : null}
    </div>
  );
}

function NoteBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "default" | "accent";
}) {
  return (
    <div
      className={cn(
        "rounded-[1.05rem] border p-3.5",
        tone === "accent"
          ? "border-[var(--color-accent)]/14 bg-[rgba(190,160,120,0.07)]"
          : "border-white/7 bg-white/[0.04]",
      )}
    >
      <p className="text-[0.68rem] uppercase tracking-[0.2em] text-white/50">{label}</p>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-white/80">{value}</p>
    </div>
  );
}

function ContactLink({
  href,
  label,
  value,
  compact = false,
}: {
  href: string | null;
  label: string;
  value: string;
  compact?: boolean;
}) {
  const className = cn(
    "block rounded-[1rem] border border-white/7 bg-white/[0.04] transition",
    compact ? "px-3.5 py-2" : "px-3.5 py-2.5",
  );

  if (!href) {
    return (
      <div className={cn(className, "opacity-60")}>
        <p className="text-[0.68rem] uppercase tracking-[0.18em] text-white/46">{label}</p>
        {!compact ? <p className="mt-2 text-sm font-medium text-white">{value}</p> : null}
      </div>
    );
  }

  return (
    <a href={href} className={cn(className, "hover:border-white/14 hover:bg-white/[0.06]")}>
      <p className="text-[0.68rem] uppercase tracking-[0.18em] text-white/46">{label}</p>
      {!compact ? <p className="mt-2 text-sm font-medium text-white">{value}</p> : null}
    </a>
  );
}

function getStatusBadgeClassName(status: AdminBookingDetailData["status"]) {
  switch (status) {
    case "PENDING":
      return "inline-flex rounded-full border border-amber-300/35 bg-amber-500/12 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-amber-100";
    case "CONFIRMED":
      return "inline-flex rounded-full border border-emerald-300/35 bg-emerald-500/12 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-emerald-100";
    case "COMPLETED":
      return "inline-flex rounded-full border border-cyan-300/35 bg-cyan-500/12 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-cyan-100";
    case "CANCELLED":
      return "inline-flex rounded-full border border-red-300/35 bg-red-500/12 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-red-100";
    case "NO_SHOW":
      return "inline-flex rounded-full border border-orange-300/35 bg-orange-500/12 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-orange-100";
    default:
      return "inline-flex rounded-full border border-white/12 bg-white/8 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-white";
  }
}

function getHistoryStatusBadgeClassName(statusLabel: string) {
  switch (statusLabel) {
    case "Čeká na potvrzení":
      return getStatusBadgeClassName("PENDING");
    case "Potvrzená":
      return getStatusBadgeClassName("CONFIRMED");
    case "Zrušená":
      return getStatusBadgeClassName("CANCELLED");
    case "Hotovo":
      return getStatusBadgeClassName("COMPLETED");
    case "Nedorazila":
      return getStatusBadgeClassName("NO_SHOW");
    default:
      return getStatusBadgeClassName("PENDING");
  }
}

function getStatusContextClassName(status: AdminBookingDetailData["status"]) {
  switch (status) {
    case "PENDING":
      return "rounded-[1.05rem] border border-amber-300/16 bg-amber-500/7 px-3.5 py-2.5";
    case "CONFIRMED":
      return "rounded-[1.05rem] border border-emerald-300/16 bg-emerald-500/7 px-3.5 py-2.5";
    case "CANCELLED":
      return "rounded-[1.05rem] border border-red-300/16 bg-red-500/7 px-3.5 py-2.5";
    case "COMPLETED":
      return "rounded-[1.05rem] border border-cyan-300/16 bg-cyan-500/7 px-3.5 py-2.5";
    case "NO_SHOW":
      return "rounded-[1.05rem] border border-orange-300/16 bg-orange-500/7 px-3.5 py-2.5";
    default:
      return "rounded-[1.05rem] border border-white/8 bg-white/[0.04] px-3.5 py-2.5";
  }
}

function getStatusContext(data: AdminBookingDetailData) {
  if (data.availableActions.length === 0) {
    switch (data.status) {
      case "CANCELLED":
        return {
          title: "Rezervace je zrušená.",
          description: "Další stavová akce teď není dostupná. Detail zůstává pro poznámky, kontakt a audit.",
        };
      case "COMPLETED":
        return {
          title: "Návštěva je uzavřená.",
          description: "Další zásah není potřeba. Vše podstatné zůstává níže v poznámkách a historii.",
        };
      case "NO_SHOW":
        return {
          title: "Rezervace je uzavřená jako nedorazila.",
          description: "Auditní stopa i interní kontext zůstávají po ruce pro další postup.",
        };
      default:
        return {
          title: "Rezervace je bez další akce.",
          description: "Detail teď slouží hlavně jako přehled a auditní stopa.",
        };
    }
  }

  switch (data.status) {
    case "PENDING":
      return {
        title: "Rezervace čeká na potvrzení.",
        description: "Nejčastější další krok je potvrzení. Pokud se plán změnil, zrušení je hned vedle.",
      };
    case "CONFIRMED":
      return {
        title: "Termín je potvrzený a připravený k obsluze.",
        description: "Po návštěvě stačí rezervaci uzavřít. Pokud klientka nepřijde, použij nedorazila.",
      };
    default:
      return {
        title: "Detail je připravený pro další krok.",
        description: "Vyber akci, krátce ji okomentuj a změna se propíše do historie rezervace.",
      };
  }
}

function buildPhoneHref(phone: string) {
  const normalized = phone.replace(/[^+\d]/g, "");
  return normalized.length > 0 ? `tel:${normalized}` : null;
}
