import Link from "next/link";

import { type AdminBookingDetailData, getAdminBookingHref } from "@/features/admin/lib/admin-booking";

import { AdminBookingStatusForm } from "./admin-booking-status-form";
import { AdminPageShell, AdminPanel } from "./admin-page-shell";

type AdminBookingDetailPageProps = {
  data: AdminBookingDetailData;
};

export function AdminBookingDetailPage({ data }: AdminBookingDetailPageProps) {
  const listHref = data.area === "owner" ? "/admin/rezervace" : "/admin/provoz/rezervace";

  return (
    <AdminPageShell
      eyebrow={data.area === "owner" ? "Detail rezervace" : "Detail termínu"}
      title={data.title}
      description={`Kód ${data.referenceCode} • ${data.scheduledAtLabel}`}
      stats={[
        {
          label: "Stav",
          value: data.statusLabel,
          tone: "accent",
          detail: "Aktuální stav rezervace.",
        },
        {
          label: "Klientka",
          value: data.clientName,
          detail: data.clientEmail,
        },
        {
          label: "Služba",
          value: data.serviceName,
          detail: data.sourceLabel,
        },
        {
          label: "Naposledy změněno",
          value: data.updatedAtLabel,
          detail: "Čas poslední změny.",
        },
      ]}
      compact={data.area === "salon"}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={listHref}
          className="rounded-full border border-white/10 px-4 py-3 text-sm text-white/78 transition hover:border-white/30 hover:text-white"
        >
          Zpět na rezervace
        </Link>
        <Link
          href={getAdminBookingHref(data.area, data.id)}
          className="rounded-full border border-white/10 px-4 py-3 text-sm text-white/78 transition hover:border-white/30 hover:text-white"
        >
          Obnovit detail
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <AdminPanel
          title="Základní přehled"
          description="Krátký souhrn všeho, co potřebuješ před dalším krokem."
          compact={data.area === "salon"}
        >
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Klientka" value={data.clientName} />
            <DetailRow label="Telefon" value={data.clientPhone} />
            <DetailRow label="E-mail" value={data.clientEmail} />
            <DetailRow label="Služba" value={data.serviceName} />
            <DetailRow label="Termín" value={data.scheduledAtLabel} />
            <DetailRow label="Vytvořeno" value={data.createdAtLabel} />
          </dl>
        </AdminPanel>

        <AdminPanel
          title="Změna stavu"
          description="Vyber jednu akci a doplň krátký důvod."
          compact={data.area === "salon"}
        >
          <AdminBookingStatusForm
            area={data.area}
            bookingId={data.id}
            availableActions={data.availableActions}
          />
        </AdminPanel>

        <AdminPanel
          title="Poznámky"
          description="Poznámka od klientky a interní poznámka pro salon."
          compact={data.area === "salon"}
        >
          <div className="grid gap-4">
            <NoteBlock
              label="Poznámka od klientky"
              value={data.clientNote ?? "Klientka nic nedopsala."}
            />
            <NoteBlock
              label="Interní poznámka"
              value={data.internalNote ?? "Interní poznámka zatím chybí."}
            />
          </div>
        </AdminPanel>

        <AdminPanel
          title="Historie změn"
          description="Přehled kroků, které se s rezervací už staly."
          compact={data.area === "salon"}
        >
          {data.historyItems.length > 0 ? (
            <div className="grid gap-3">
              {data.historyItems.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h4 className="text-base font-medium text-white">{item.statusLabel}</h4>
                      <p className="mt-1 text-sm leading-6 text-white/58">
                        {item.actorLabel} • {item.createdAtLabel}
                      </p>
                    </div>
                  </div>
                  {item.reason ? (
                    <p className="mt-3 text-sm leading-6 text-white/78">
                      <span className="font-medium text-white">Důvod:</span> {item.reason}
                    </p>
                  ) : null}
                  {item.note ? (
                    <p className="mt-2 text-sm leading-6 text-white/72">
                      <span className="font-medium text-white">Poznámka:</span> {item.note}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-white/14 bg-white/4 p-5">
              <p className="text-sm leading-6 text-white/68">Historie změn zatím není k dispozici.</p>
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

function NoteBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-white/52">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/82">{value}</p>
    </div>
  );
}
