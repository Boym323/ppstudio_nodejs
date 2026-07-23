"use client";

import Link from "next/link";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { cn } from "@/lib/utils";

type AdminClientListItem = {
  id: string;
  href: string;
  fullName: string;
  email: string;
  emailHref: string | null;
  phoneDisplay: string;
  phoneHref: string | null;
  isActive: boolean;
  totalBookings: number;
  lastVisitLabel: string;
  lastServiceName: string | null;
  weeksWithoutVisit: number | null;
  nextBookingLabel: string;
  hasNote: boolean;
  isTestRecord: boolean;
};

type AdminClientsListProps = {
  resetHref: string;
  clients: AdminClientListItem[];
  emptyState?: { title: string; description: string };
};

const columns: ColumnDef<AdminClientListItem>[] = [
  {
    id: "client",
    header: "Klientka",
    cell: ({ row }) => <ClientCell client={row.original} />,
  },
  {
    id: "lastVisit",
    header: "Poslední návštěva",
    cell: ({ row }) => <LastVisitCell client={row.original} />,
  },
  {
    id: "nextBooking",
    header: "Příští návštěva",
    cell: ({ row }) => <p className={cn("min-w-44", row.original.nextBookingLabel === "Bez další rezervace" ? "text-white/45" : "text-emerald-200/82")}>{row.original.nextBookingLabel}</p>,
  },
  {
    accessorKey: "totalBookings",
    header: "Rezervace",
    cell: ({ getValue }) => <p className="text-white/78">{getValue<number>()}</p>,
  },
  {
    id: "context",
    header: "Kontext",
    cell: ({ row }) => <div className="grid gap-1.5"><NoteBadge hasNote={row.original.hasNote} /><StatusBadge isActive={row.original.isActive} /></div>,
  },
  {
    id: "actions",
    header: "Akce",
    cell: ({ row }) => <Link href={row.original.href} className="inline-flex min-h-9 items-center rounded-full border border-white/10 px-3 text-xs font-medium text-white/78 transition hover:border-[var(--color-accent)]/40 hover:bg-[rgba(190,160,120,0.10)] hover:text-white">Detail</Link>,
  },
];

export function AdminClientsList({ clients, resetHref, emptyState }: AdminClientsListProps) {
  const table = useReactTable({
    data: clients,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (client) => client.id,
  });

  if (clients.length === 0) {
    return <EmptyState resetHref={resetHref} emptyState={emptyState} />;
  }

  return (
    <div className="min-w-0 max-w-full overflow-x-clip">
      <div className="hidden overflow-x-auto rounded-[1.1rem] border border-white/8 bg-white/4 lg:block">
        <table className="min-w-[900px] w-full border-collapse text-left text-sm">
          <thead className="border-b border-white/8 text-[11px] uppercase tracking-[0.16em] text-white/42">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} scope="col" className="px-3 py-2 font-medium">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-white/7">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={cn("transition hover:bg-white/5", !row.original.isActive && "text-white/52") }>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-3 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid min-w-0 max-w-full gap-2 lg:hidden">
        {table.getRowModel().rows.map((row) => <ClientCard key={row.id} client={row.original} />)}
      </div>
    </div>
  );
}

function EmptyState({ resetHref, emptyState }: { resetHref: string; emptyState?: { title: string; description: string } }) {
  return <div className="rounded-[1.2rem] border border-dashed border-white/14 bg-white/4 p-5"><p className="text-base font-medium text-white">{emptyState?.title ?? "Nenalezeni žádní klienti."}</p><a href={resetHref} className="mt-4 inline-flex rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6">Zrušit filtr</a></div>;
}

function ClientCell({ client }: { client: AdminClientListItem }) {
  return <div className={cn("min-w-52", !client.isActive && "opacity-65")}><div className="flex items-center gap-2"><Link href={client.href} className="truncate font-medium text-white transition hover:text-[var(--color-accent-soft)]">{client.fullName}</Link>{client.isTestRecord ? <TestBadge /> : null}</div><Contact client={client} compact /></div>;
}

function LastVisitCell({ client }: { client: AdminClientListItem }) {
  return <div className="min-w-40"><p className={client.lastVisitLabel === "Bez návštěvy" ? "text-white/45" : "text-white/76"}>{client.lastVisitLabel}</p>{client.lastServiceName ? <p className="mt-0.5 truncate text-xs text-white/48">{client.lastServiceName}</p> : null}{client.weeksWithoutVisit !== null ? <p className="mt-0.5 text-xs text-white/42">{client.weeksWithoutVisit} {client.weeksWithoutVisit === 1 ? "týden" : "týdnů"} od návštěvy</p> : null}</div>;
}

function ClientCard({ client }: { client: AdminClientListItem }) {
  return <article className={cn("w-full min-w-0 overflow-hidden rounded-[1.05rem] border border-white/8 bg-white/5 p-3", !client.isActive && "opacity-70")}><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><h3 className="min-w-0 break-words text-base font-medium text-white">{client.fullName}</h3>{client.isTestRecord ? <TestBadge /> : null}</div><Contact client={client} /></div><StatusBadge isActive={client.isActive} /></div><dl className="mt-3 grid min-w-0 grid-cols-1 gap-y-2 text-sm sm:grid-cols-2 sm:gap-x-3"><CardDetail label="Poslední návštěva" value={client.lastVisitLabel} detail={client.lastServiceName ?? (client.weeksWithoutVisit !== null ? `${client.weeksWithoutVisit} týdnů od návštěvy` : undefined)} /><CardDetail label="Příští návštěva" value={client.nextBookingLabel} /><CardDetail label="Rezervace" value={formatBookingCount(client.totalBookings)} /><CardDetail label="Poznámka" value={client.hasNote ? "S poznámkou" : "Bez poznámky"} /></dl><div className="mt-3 flex min-w-0 flex-wrap gap-2">{client.phoneHref ? <a href={client.phoneHref} className="inline-flex min-h-11 min-w-0 items-center rounded-full border border-white/10 px-3 text-sm text-white/80">Zavolat</a> : null}{client.emailHref ? <a href={client.emailHref} className="inline-flex min-h-11 min-w-0 items-center rounded-full border border-white/10 px-3 text-sm text-white/80">Napsat</a> : null}<Link href={client.href} className="inline-flex min-h-11 min-w-0 items-center rounded-full bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-accent-contrast)]">Detail</Link></div></article>;
}

function Contact({ client, compact = false }: { client: AdminClientListItem; compact?: boolean }) {
  if (!client.email && !client.phoneDisplay) return <p className="mt-1 text-xs font-medium text-amber-100/78">Bez kontaktu</p>;
  return <div className={cn("min-w-0", compact ? "mt-1 flex flex-wrap gap-x-2 text-xs" : "mt-1.5 grid gap-0.5 text-sm")}>{client.emailHref ? <a href={client.emailHref} className="min-w-0 break-words [overflow-wrap:anywhere] text-white/68 hover:text-white">{client.email}</a> : <span className="text-white/38">Bez e-mailu</span>}{client.phoneHref ? <a href={client.phoneHref} className="min-w-0 break-words text-white/58 hover:text-white">{client.phoneDisplay}</a> : <span className="text-white/38">Bez telefonu</span>}</div>;
}

function CardDetail({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className="min-w-0"><dt className="text-[10px] uppercase tracking-[0.14em] text-white/38">{label}</dt><dd className="mt-0.5 break-words text-white/75">{value}</dd>{detail ? <dd className="break-words text-xs text-white/43">{detail}</dd> : null}</div>; }
function formatBookingCount(count: number) { return `${count} ${count === 1 ? "rezervace" : count >= 2 && count <= 4 ? "rezervace" : "rezervací"}`; }
function NoteBadge({ hasNote }: { hasNote: boolean }) { return <span className={cn("inline-flex w-fit rounded-full border px-2 py-1 text-xs leading-none", hasNote ? "border-[var(--color-accent)]/28 bg-[rgba(190,160,120,0.10)] text-[var(--color-accent-soft)]" : "border-white/8 bg-black/10 text-white/42")}>{hasNote ? "S poznámkou" : "Bez poznámky"}</span>; }
function StatusBadge({ isActive }: { isActive: boolean }) { return <span className={cn("inline-flex w-fit shrink-0 rounded-full border px-2.5 py-1 text-xs leading-none", isActive ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100" : "border-white/10 bg-black/10 text-white/58")}>{isActive ? "Aktivní" : "Neaktivní"}</span>; }
function TestBadge() { return <span className="shrink-0 rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[10px] leading-none text-amber-100/78">test</span>; }
