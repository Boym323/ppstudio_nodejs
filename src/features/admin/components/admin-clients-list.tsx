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
          className="group block rounded-[1.25rem] border border-white/8 bg-white/5 p-3.5 transition hover:border-white/16 hover:bg-white/7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60 sm:p-4"
        >
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-col gap-2 md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-3">
                <h3 className="min-w-0 truncate text-base font-medium text-white sm:text-[1.05rem]">
                  {client.fullName}
                </h3>
                <span
                  className={cn(
                    "inline-flex w-fit max-w-full shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] md:justify-self-end",
                    client.isActive
                      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
                      : "border-white/10 bg-black/10 text-white/58",
                  )}
                >
                  {client.isActive ? "Aktivní" : "Neaktivní"}
                </span>
              </div>

              <p className="mt-1 text-sm leading-5 text-white/62">
                {client.email || "Bez e-mailu"}
                {client.phone ? ` • ${client.phone}` : ""}
              </p>

              {client.internalNote ? (
                <div className="mt-2 rounded-[0.95rem] border border-[var(--color-accent)]/18 bg-[rgba(190,160,120,0.06)] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent-soft)]">
                    Interní poznámka
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-white/72">
                    {client.internalNote}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap md:justify-end">
              <span className="inline-flex w-fit max-w-full items-center rounded-full border border-white/10 px-2.5 py-1 text-xs leading-4 text-white/64">
                Rezervace {client._count.bookings}
              </span>
              <span className="inline-flex w-fit max-w-full items-center rounded-full border border-white/10 px-2.5 py-1 text-xs leading-4 whitespace-normal break-words text-white/64">
                Poslední návštěva {formatDateLabel(client.lastBookedAt)}
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
