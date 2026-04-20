import Link from "next/link";

import { type AdminClientDetailData } from "@/features/admin/lib/admin-clients";
import { cn } from "@/lib/utils";

import { AdminClientNoteForm } from "./admin-client-note-form";
import { AdminPageShell, AdminPanel } from "./admin-page-shell";

type AdminClientDetailPageProps = {
  data: AdminClientDetailData;
};

export function AdminClientDetailPage({ data }: AdminClientDetailPageProps) {
  const listHref = data.area === "owner" ? "/admin/klienti" : "/admin/provoz/klienti";

  return (
    <AdminPageShell
      eyebrow={data.area === "owner" ? "Detail klienta" : "Detail klientky"}
      title={data.fullName}
      description={data.area === "owner"
        ? "Klientská karta s kontaktem, historií a interním provozním kontextem."
        : "Rychlá karta klientky pro běžný provoz a navázání na předchozí návštěvy."}
      stats={[
        {
          label: "Stav profilu",
          value: data.statusLabel,
          tone: data.isActive ? "accent" : "muted",
          detail: "Profil zůstává navázaný na rezervace a interní poznámky.",
        },
        {
          label: "Rezervací celkem",
          value: String(data.totalBookings),
          detail: `Dokončené ${data.completedBookings} • Nedorazila ${data.noShowBookings}`,
        },
        {
          label: "Poslední návštěva",
          value: data.lastBookedAtLabel,
          detail: `Budoucí termíny ${data.upcomingBookings}`,
        },
        {
          label: "Nejčastější služba",
          value: data.favoriteServiceName,
          detail: data.nextBookingLabel,
        },
      ]}
      compact={data.area === "salon"}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={listHref}
          className="rounded-full border border-white/10 px-4 py-3 text-sm text-white/78 transition hover:border-white/30 hover:text-white"
        >
          Zpět na klienty
        </Link>
        <Link
          href={data.area === "owner" ? `/admin/klienti/${data.id}` : `/admin/provoz/klienti/${data.id}`}
          className="rounded-full border border-white/10 px-4 py-3 text-sm text-white/78 transition hover:border-white/30 hover:text-white"
        >
          Obnovit detail
        </Link>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[var(--radius-panel)] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <span className={getClientBadgeClassName(data.isActive)}>
                {data.statusLabel}
              </span>
              <h3 className="mt-4 font-display text-3xl text-white sm:text-4xl">
                {data.fullName}
              </h3>
              <p className="mt-3 text-sm leading-7 text-white/74 sm:text-base">
                Poslední návštěva {data.lastBookedAtLabel}. Další termín {data.nextBookingLabel.toLowerCase()}.
              </p>
            </div>

            <div className="min-w-[14rem] rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/52">Operační souhrn</p>
              <p className="mt-3 text-base font-medium text-white">{data.favoriteServiceName}</p>
              <p className="mt-2 text-sm leading-6 text-white/66">
                Nejčastější služba podle dosavadní historie rezervací.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <SummaryTile label="Kontakt" value={data.email} detail={data.phone} />
            <SummaryTile label="Další termín" value={data.nextBookingLabel} />
            <SummaryTile label="Profil založen" value={data.createdAtLabel} detail={data.updatedAtLabel} />
          </div>
        </div>

        <div className="grid gap-4">
          <QuickActionCard
            title="Rychlý kontakt"
            description="Telefon a e-mail zůstávají po ruce bez hledání v rezervacích."
          >
            <div className="grid gap-3">
              <ContactLink
                href={data.phone !== "Telefon není vyplněný" ? buildPhoneHref(data.phone) : undefined}
                label="Zavolat klientce"
                value={data.phone}
              />
              <ContactLink href={`mailto:${data.email}`} label="Napsat e-mail" value={data.email} />
            </div>
          </QuickActionCard>

          <QuickActionCard
            title="Profil klientky"
            description="Základní metadata bez přepínání mezi obrazovkami."
          >
            <dl className="grid gap-3">
              <MetaRow label="Vytvořeno" value={data.createdAtLabel} />
              <MetaRow label="Naposledy upraveno" value={data.updatedAtLabel} />
              <MetaRow label="Poslední návštěva" value={data.lastBookedAtLabel} />
            </dl>
          </QuickActionCard>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <AdminPanel
          title="Klientská karta"
          description="Základní kontext pro orientaci, zavolání nebo navázání na předchozí péči."
          compact={data.area === "salon"}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Jméno" value={data.fullName} />
            <DetailRow label="E-mail" value={data.email} />
            <DetailRow label="Telefon" value={data.phone} />
            <DetailRow label="Další termín" value={data.nextBookingLabel} />
            <DetailRow label="Rezervací celkem" value={String(data.totalBookings)} />
            <DetailRow label="Nejčastější služba" value={data.favoriteServiceName} />
          </div>
        </AdminPanel>

        <AdminPanel
          title="Interní poznámka"
          description="Krátký provozní kontext, který zůstává jen pro tým."
          compact={data.area === "salon"}
        >
          <AdminClientNoteForm
            area={data.area}
            clientId={data.id}
            initialValue={data.internalNote}
          />
        </AdminPanel>

        <AdminPanel
          title="Poslední rezervace"
          description="Nejnovější termíny s rychlou cestou do detailu rezervace."
          compact={data.area === "salon"}
        >
          {data.bookings.length > 0 ? (
            <div className="grid gap-4">
              {data.bookings.map((booking) => (
                <Link
                  key={booking.id}
                  href={booking.href}
                  className="block rounded-[1.35rem] border border-white/8 bg-white/5 p-4 transition hover:border-white/16 hover:bg-white/7"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="max-w-2xl">
                      <h4 className="text-base font-medium text-white">{booking.serviceName}</h4>
                      <p className="mt-1 text-sm leading-6 text-white/58">
                        {booking.scheduledAtLabel}
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--color-accent)]/40 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">
                      {booking.statusLabel}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-white/72">
                    {booking.sourceLabel} • {booking.noteSummary}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-white/14 bg-white/4 p-5">
              <p className="text-sm leading-6 text-white/68">Klientka zatím nemá žádnou rezervaci.</p>
            </div>
          )}
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4">
      <dt className="text-xs uppercase tracking-[0.24em] text-white/52">{label}</dt>
      <dd className="mt-2 text-sm leading-6 text-white/88">{value}</dd>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-[1.2rem] border border-white/10 bg-black/16 p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-white/48">{label}</p>
      <p className="mt-3 text-sm leading-6 text-white">{value}</p>
      {detail ? (
        <p className="mt-2 text-sm leading-6 text-white/56">{detail}</p>
      ) : null}
    </div>
  );
}

function QuickActionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-black/14 p-4">
      <p className="text-base font-medium text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/62">{description}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function ContactLink({
  href,
  label,
  value,
}: {
  href?: string;
  label: string;
  value: string;
}) {
  if (!href) {
    return (
      <div className="rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.2em] text-white/48">{label}</p>
        <p className="mt-2 text-sm text-white/72">{value}</p>
      </div>
    );
  }

  return (
    <a
      href={href}
      className="rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3 transition hover:border-white/18 hover:bg-white/7"
    >
      <p className="text-xs uppercase tracking-[0.2em] text-white/48">{label}</p>
      <p className="mt-2 text-sm text-white/88">{value}</p>
    </a>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-white/8 bg-white/5 px-4 py-3">
      <dt className="text-xs uppercase tracking-[0.2em] text-white/48">{label}</dt>
      <dd className="mt-2 text-sm text-white/84">{value}</dd>
    </div>
  );
}

function buildPhoneHref(phone: string) {
  return `tel:${phone.replace(/\s+/g, "")}`;
}

function getClientBadgeClassName(isActive: boolean) {
  return cn(
    "inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.22em]",
    isActive
      ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-100"
      : "border-white/10 bg-white/8 text-white/64",
  );
}
