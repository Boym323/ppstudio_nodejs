import Link from "next/link";

import { getAdminClientHref } from "@/features/admin/lib/admin-clients";
import { cn } from "@/lib/utils";
import { type AdminArea } from "@/config/navigation";

type AdminClientsListProps = {
  area: AdminArea;
  resetHref: string;
  clients: Array<{
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    lastBookedAt: Date | null;
    internalNote: string | null;
    _count: {
      bookings: number;
    };
    isTestRecord: boolean;
  }>;
};

const formatDate = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

function formatDateLabel(value: Date | null | undefined) {
  if (!value) {
    return "Bez návštěvy";
  }

  return formatDate.format(value);
}

export function AdminClientsList({
  area,
  resetHref,
  clients,
}: AdminClientsListProps) {
  if (clients.length === 0) {
    return (
      <div className="rounded-[1.2rem] border border-dashed border-white/14 bg-white/4 p-5">
        <p className="text-base font-medium text-white">Nenalezeni žádní klienti.</p>
        <a
          href={resetHref}
          className="mt-4 inline-flex rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6"
        >
          Zrušit filtr
        </a>
      </div>
    );
  }

  return (
    <div>
      <div className="hidden overflow-hidden rounded-[1.1rem] border border-white/8 bg-white/4 lg:block">
        <div className="grid grid-cols-[minmax(160px,1.25fr)_minmax(190px,1.35fr)_90px_130px_105px_95px_82px] gap-3 border-b border-white/8 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-white/42">
          <span>Klientka</span>
          <span>Kontakt</span>
          <span>Rezervace</span>
          <span>Poslední návštěva</span>
          <span>Poznámka</span>
          <span>Stav</span>
          <span className="text-right">Akce</span>
        </div>

        <div className="divide-y divide-white/7">
          {clients.map((client) => (
            <Link
              key={client.id}
              href={getAdminClientHref(area, client.id)}
              className="group grid min-h-14 grid-cols-[minmax(160px,1.25fr)_minmax(190px,1.35fr)_90px_130px_105px_95px_82px] items-center gap-3 px-3 py-2.5 text-sm transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)]/60"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="min-w-0 truncate font-medium text-white">{client.fullName}</p>
                  {client.isTestRecord ? <TestBadge /> : null}
                </div>
              </div>

              <ContactCell email={client.email} phone={client.phone} />

              <p className="text-white/72">{client._count.bookings}</p>
              <p className="truncate text-white/68">{formatDateLabel(client.lastBookedAt).toLocaleLowerCase("cs-CZ")}</p>
              <NoteBadge hasNote={hasNote(client.internalNote)} />
              <StatusBadge isActive={client.isActive} />
              <span
                className="justify-self-end rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white/78 transition group-hover:border-[var(--color-accent)]/40 group-hover:bg-[rgba(190,160,120,0.10)] group-hover:text-white"
              >
                Detail
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-2 lg:hidden">
        {clients.map((client) => (
          <Link
            key={client.id}
            href={getAdminClientHref(area, client.id)}
            className="block rounded-[1.05rem] border border-white/8 bg-white/5 p-3 transition hover:bg-white/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60"
          >
            <article>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h3 className="min-w-0 truncate text-base font-medium text-white">{client.fullName}</h3>
                    {client.isTestRecord ? <TestBadge /> : null}
                  </div>
                  <div className="mt-1">
                    <ContactCell email={client.email} phone={client.phone} />
                  </div>
                </div>
                <StatusBadge isActive={client.isActive} />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <MetaCell label="Rezervace" value={String(client._count.bookings)} />
                <MetaCell label="Poslední návštěva" value={formatDateLabel(client.lastBookedAt).toLocaleLowerCase("cs-CZ")} />
                <MetaCell label="Poznámka" value={hasNote(client.internalNote) ? "ano" : "bez poznámky"} />
                <span className="inline-flex items-center justify-center rounded-full border border-white/10 px-3 py-2 text-sm font-medium text-white/82">
                  Detail
                </span>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </div>
  );
}

function hasNote(value: string | null) {
  return Boolean(value?.trim());
}

function hasContactValue(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function ContactCell({
  email,
  phone,
}: {
  email: string;
  phone: string | null;
}) {
  const hasEmail = hasContactValue(email);
  const hasPhone = hasContactValue(phone);

  if (!hasEmail && !hasPhone) {
    return <p className="truncate text-white/45">bez kontaktu</p>;
  }

  return (
    <div className="min-w-0 space-y-0.5">
      <p className={cn("truncate", hasEmail ? "text-white/72" : "text-white/42")}>
        {hasEmail ? email : "bez e-mailu"}
      </p>
      <p className={cn("truncate text-xs", hasPhone ? "text-white/58" : "text-white/36")}>
        {hasPhone ? phone : "bez telefonu"}
      </p>
    </div>
  );
}

function NoteBadge({ hasNote }: { hasNote: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border px-2 py-1 text-xs leading-none",
        hasNote
          ? "border-[var(--color-accent)]/28 bg-[rgba(190,160,120,0.10)] text-[var(--color-accent-soft)]"
          : "border-white/8 bg-black/10 text-white/42",
      )}
    >
      {hasNote ? "ano" : "bez poznámky"}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-full border px-2.5 py-1 text-xs leading-none",
        isActive
          ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
          : "border-white/10 bg-black/10 text-white/58",
      )}
    >
      {isActive ? "Aktivní" : "Neaktivní"}
    </span>
  );
}

function TestBadge() {
  return (
    <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[10px] leading-none text-amber-100/78">
      test
    </span>
  );
}

function MetaCell({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-[0.75rem] border border-white/8 bg-black/10 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/38">{label}</p>
      <p className="mt-1 truncate text-white/72">{value}</p>
    </div>
  );
}
