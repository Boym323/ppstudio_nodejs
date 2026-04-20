import Link from "next/link";

import { type AdminBookingDetailData, getAdminBookingHref } from "@/features/admin/lib/admin-booking";
import { cn } from "@/lib/utils";

import { AdminBookingStatusForm } from "./admin-booking-status-form";
import { AdminPageShell, AdminPanel } from "./admin-page-shell";

type AdminBookingDetailPageProps = {
  data: AdminBookingDetailData;
};

export function AdminBookingDetailPage({ data }: AdminBookingDetailPageProps) {
  const listHref = data.area === "owner" ? "/admin/rezervace" : "/admin/provoz/rezervace";
  const nextStepCopy = getNextStepCopy(data);

  return (
    <AdminPageShell
      eyebrow={data.area === "owner" ? "Detail rezervace" : "Detail termínu"}
      title={data.title}
      description={data.scheduledAtLabel}
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

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[var(--radius-panel)] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.10),rgba(255,255,255,0.03))] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <span className={getStatusBadgeClassName(data.status)}>
                {data.statusLabel}
              </span>
              <h3 className="mt-4 font-display text-3xl text-white sm:text-4xl">
                {data.serviceName}
              </h3>
              <p className="mt-3 text-sm leading-7 text-white/74 sm:text-base">
                {data.clientName} má termín {data.scheduledAtLabel}. Zdroj rezervace:{" "}
                {data.sourceLabel.toLowerCase()}.
              </p>
            </div>

            <div className="min-w-[14rem] rounded-[1.4rem] border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/52">Další krok</p>
              <p className="mt-3 text-base font-medium text-white">{nextStepCopy.title}</p>
              <p className="mt-2 text-sm leading-6 text-white/66">{nextStepCopy.description}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <SummaryTile label="Termín" value={data.scheduledAtLabel} />
            <SummaryTile label="Klientka" value={data.clientName} detail={data.clientPhone} />
            <SummaryTile label="Poslední změna" value={data.updatedAtLabel} detail={data.statusLabel} />
          </div>
        </div>

        <div className="grid gap-4">
          <QuickActionCard
            title="Rychlý kontakt"
            description="Když je potřeba něco ověřit nebo potvrdit, máš kontakt hned po ruce."
          >
            <div className="grid gap-3">
              <ContactLink
                href={buildPhoneHref(data.clientPhone)}
                label="Zavolat klientce"
                value={data.clientPhone}
              />
              <ContactLink href={`mailto:${data.clientEmail}`} label="Napsat e-mail" value={data.clientEmail} />
            </div>
          </QuickActionCard>

          <QuickActionCard
            title="Kontext rezervace"
            description="Základní metadata bez hledání v historii."
          >
            <dl className="grid gap-3">
              <MetaRow label="Vytvořeno" value={data.createdAtLabel} />
              <MetaRow label="Naposledy upraveno" value={data.updatedAtLabel} />
              <MetaRow label="Zdroj" value={data.sourceLabel} />
            </dl>
          </QuickActionCard>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <AdminPanel
          title="Základní přehled"
          description="Nejdůležitější informace v jednom klidném bloku pro rychlé rozhodnutí."
          compact={data.area === "salon"}
        >
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Klientka" value={data.clientName} />
              <DetailRow label="Telefon" value={data.clientPhone} />
              <DetailRow label="E-mail" value={data.clientEmail} />
              <DetailRow label="Služba" value={data.serviceName} />
              <DetailRow label="Termín" value={data.scheduledAtLabel} />
              <DetailRow label="Vytvořeno" value={data.createdAtLabel} />
            </dl>

            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-white/52">Operační souhrn</p>
              <ul className="mt-4 grid gap-3 text-sm leading-6 text-white/76">
                <li className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3">
                  Stav rezervace je{" "}
                  <span className="font-medium text-white">{data.statusLabel.toLowerCase()}</span>.
                </li>
                <li className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3">
                  Poslední změna proběhla{" "}
                  <span className="font-medium text-white">{data.updatedAtLabel}</span>.
                </li>
                <li className="rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3">
                  Klientka přišla přes{" "}
                  <span className="font-medium text-white">{data.sourceLabel.toLowerCase()}</span>.
                </li>
              </ul>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel
          title="Změna stavu"
          description="Vyber další krok, přidej krátký důvod a systém uloží čistou auditní stopu."
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
          description="Odděleně odlišené to, co napsala klientka, a to, co zůstává jen pro tým."
          compact={data.area === "salon"}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <NoteBlock
              label="Poznámka od klientky"
              value={data.clientNote ?? "Klientka nic nedopsala."}
              tone="default"
            />
            <NoteBlock
              label="Interní poznámka"
              value={data.internalNote ?? "Interní poznámka zatím chybí."}
              tone="accent"
            />
          </div>
        </AdminPanel>

        <AdminPanel
          title="Historie změn"
          description="Časová osa všech důležitých kroků, aby šlo rezervaci rychle dohledat i zpětně."
          compact={data.area === "salon"}
        >
          {data.historyItems.length > 0 ? (
            <div className="grid gap-4">
              {data.historyItems.map((item, index) => (
                <article
                  key={item.id}
                  className="relative overflow-hidden rounded-[1.35rem] border border-white/8 bg-white/5 p-4 sm:p-5"
                >
                  <div className="absolute inset-y-0 left-0 w-1 bg-[var(--color-accent)]/35" />
                  <div className="flex flex-wrap items-start justify-between gap-3 pl-2">
                    <div className="max-w-2xl">
                      <p className="text-xs uppercase tracking-[0.24em] text-white/48">
                        Krok {data.historyItems.length - index}
                      </p>
                      <h4 className="text-base font-medium text-white">{item.statusLabel}</h4>
                      <p className="mt-1 text-sm leading-6 text-white/58">
                        {item.actorLabel} • {item.createdAtLabel}
                      </p>
                    </div>
                  </div>
                  {item.reason ? (
                    <p className="mt-3 rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3 text-sm leading-6 text-white/78">
                      <span className="font-medium text-white">Důvod:</span> {item.reason}
                    </p>
                  ) : null}
                  {item.note ? (
                    <p className="mt-2 rounded-[1rem] border border-white/8 bg-black/20 px-4 py-3 text-sm leading-6 text-white/72">
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
        "rounded-[1.25rem] border p-4",
        tone === "accent"
          ? "border-[var(--color-accent)]/18 bg-[rgba(190,160,120,0.08)]"
          : "border-white/8 bg-white/5",
      )}
    >
      <p className="text-xs uppercase tracking-[0.24em] text-white/52">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/82">{value}</p>
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
    <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-white/52">{label}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-white">{value}</p>
      {detail ? <p className="mt-1 text-sm leading-6 text-white/58">{detail}</p> : null}
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
    <section className="rounded-[1.5rem] border border-white/10 bg-black/10 p-5">
      <h3 className="font-display text-2xl text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/64">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ContactLink({
  href,
  label,
  value,
}: {
  href: string | null;
  label: string;
  value: string;
}) {
  const className =
    "block rounded-[1.1rem] border border-white/8 bg-white/5 px-4 py-3 transition";

  if (!href) {
    return (
      <div className={cn(className, "opacity-60")}>
        <p className="text-xs uppercase tracking-[0.24em] text-white/48">{label}</p>
        <p className="mt-2 text-sm font-medium text-white">{value}</p>
      </div>
    );
  }

  return (
    <a href={href} className={cn(className, "hover:border-white/18 hover:bg-white/7")}>
      <p className="text-xs uppercase tracking-[0.24em] text-white/48">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </a>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[1rem] border border-white/8 bg-white/5 px-4 py-3">
      <dt className="text-sm text-white/58">{label}</dt>
      <dd className="text-right text-sm font-medium text-white">{value}</dd>
    </div>
  );
}

function getStatusBadgeClassName(status: AdminBookingDetailData["status"]) {
  switch (status) {
    case "PENDING":
      return "inline-flex rounded-full border border-amber-300/45 bg-amber-500/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-100";
    case "CONFIRMED":
      return "inline-flex rounded-full border border-emerald-300/45 bg-emerald-500/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100";
    case "COMPLETED":
      return "inline-flex rounded-full border border-cyan-300/45 bg-cyan-500/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100";
    case "CANCELLED":
      return "inline-flex rounded-full border border-red-300/45 bg-red-500/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-red-100";
    case "NO_SHOW":
      return "inline-flex rounded-full border border-orange-300/45 bg-orange-500/14 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-100";
    default:
      return "inline-flex rounded-full border border-white/14 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white";
  }
}

function getNextStepCopy(data: AdminBookingDetailData) {
  if (data.availableActions.length === 0) {
    return {
      title: "Rezervace už nepotřebuje další zásah.",
      description: "Použij detail hlavně pro dohledání poznámek, historie a kontaktu na klientku.",
    };
  }

  switch (data.status) {
    case "PENDING":
      return {
        title: "Zkontrolovat a potvrdit termín.",
        description:
          "Pokud vše sedí, potvrzení je nejrychlejší další krok. Když se plán mění, zrušení zůstává hned vedle.",
      };
    case "CONFIRMED":
      return {
        title: "Po návštěvě rezervaci uzavři.",
        description:
          "Jakmile služba proběhne, označ ji jako hotovou. Pokud klientka nepřijde, zvol nedorazila.",
      };
    default:
      return {
        title: "Detail je připravený pro kontrolu souvislostí.",
        description:
          "Máš po ruce kontakt, poznámky i auditní stopu, kdybys potřeboval dohledat poslední změnu.",
      };
  }
}

function buildPhoneHref(phone: string) {
  const normalized = phone.replace(/[^+\d]/g, "");
  return normalized.length > 0 ? `tel:${normalized}` : null;
}
