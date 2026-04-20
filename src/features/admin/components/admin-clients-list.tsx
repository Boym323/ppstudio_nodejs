import Link from "next/link";

import { getAdminClientHref } from "@/features/admin/lib/admin-clients";
import { cn } from "@/lib/utils";
import { type AdminArea } from "@/config/navigation";

type AdminClientsListProps = {
  area: AdminArea;
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
  clients,
}: AdminClientsListProps) {
  if (clients.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-white/14 bg-white/4 p-5">
        <p className="text-base font-medium text-white">Filtru zatím nikdo neodpovídá.</p>
        <p className="mt-2 text-sm leading-6 text-white/62">
          Zkuste upravit hledání nebo přepnout stav klientky.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {clients.map((client) => (
        <Link
          key={client.id}
          href={getAdminClientHref(area, client.id)}
          className="block rounded-[1.4rem] border border-white/8 bg-white/5 p-4 transition hover:border-white/16 hover:bg-white/7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-medium text-white sm:text-lg">{client.fullName}</h3>
              <p className="mt-1 text-sm leading-6 text-white/58">
                {client.email}
                {client.phone ? ` • ${client.phone}` : ""}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em]",
                client.isActive
                  ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                  : "border-white/10 bg-black/10 text-white/58",
              )}
            >
              {client.isActive ? "Aktivní" : "Neaktivní"}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs leading-5 text-white/66">
            <span className="rounded-full border border-white/10 px-3 py-1 text-white/62">
              Rezervace {client._count.bookings}
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1 text-white/62">
              Poslední návštěva {formatDateLabel(client.lastBookedAt)}
            </span>
            {client.internalNote ? (
              <span className="rounded-full border border-[var(--color-accent)]/30 bg-[rgba(190,160,120,0.08)] px-3 py-1 text-[var(--color-accent-soft)]">
                Má interní poznámku
              </span>
            ) : null}
          </div>

          <p className="mt-3 text-sm leading-6 text-white/56">
            {client.internalNote ?? "Bez interní poznámky. Otevři detail a doplň rychlý provozní kontext."}
          </p>
        </Link>
      ))}
    </div>
  );
}
