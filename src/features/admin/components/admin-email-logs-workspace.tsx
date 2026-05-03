"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";

import { retryEmailLogAction } from "../actions/email-log-actions";
import { type EmailLogsDashboardData } from "../lib/admin-data";
import { AdminKeyValueList, AdminPanel } from "./admin-page-shell";

type AdminEmailLogsWorkspaceProps = {
  data: EmailLogsDashboardData;
};

type EmailStatusFilterValue =
  | "all"
  | "sent"
  | "pending"
  | "processing"
  | "retry"
  | "failed";

type EmailTypeFilterValue =
  | "all"
  | "booking_received"
  | "booking_confirmation"
  | "reminder"
  | "cancellation"
  | "reschedule"
  | "voucher"
  | "admin"
  | "other";

type EmailDateFilterValue = "all" | "today" | "7d" | "30d";

const healthToneStyles = {
  ok: "border-emerald-300/20 bg-emerald-400/10",
  warning: "border-amber-300/20 bg-amber-400/10",
  error: "border-red-300/20 bg-red-400/10",
} as const;

const healthBadgeStyles = {
  ok: "border-emerald-200/25 bg-emerald-200/12 text-emerald-50",
  warning: "border-amber-200/25 bg-amber-200/12 text-amber-50",
  error: "border-red-200/25 bg-red-200/12 text-red-50",
} as const;

const queueStatToneStyles = {
  default: "border-white/10 bg-white/5 text-white",
  accent: "border-[var(--color-accent)]/40 bg-[rgba(190,160,120,0.12)] text-white",
  muted: "border-white/8 bg-black/20 text-white/90",
} as const;

const statusBadgeStyles = {
  sent: "border-emerald-300/25 bg-emerald-400/10 text-emerald-50",
  pending: "border-amber-300/25 bg-amber-400/10 text-amber-50",
  processing: "border-sky-300/25 bg-sky-400/10 text-sky-50",
  retry: "border-orange-300/25 bg-orange-400/10 text-orange-50",
  failed: "border-red-300/25 bg-red-400/10 text-red-50",
} as const;

const typeBadgeStyles = {
  booking_received: "border-teal-300/25 bg-teal-400/10 text-teal-50",
  booking_confirmation: "border-[var(--color-accent)]/40 bg-[rgba(190,160,120,0.12)] text-[var(--color-accent-soft)]",
  reminder: "border-sky-300/25 bg-sky-400/10 text-sky-50",
  cancellation: "border-rose-300/25 bg-rose-400/10 text-rose-50",
  reschedule: "border-violet-300/25 bg-violet-400/10 text-violet-50",
  voucher: "border-amber-300/25 bg-amber-400/10 text-amber-50",
  admin: "border-white/12 bg-white/8 text-white/86",
  other: "border-white/10 bg-black/20 text-white/72",
} as const;

export function AdminEmailLogsWorkspace({ data }: AdminEmailLogsWorkspaceProps) {
  const [statusFilter, setStatusFilter] = useState<EmailStatusFilterValue>("all");
  const [typeFilter, setTypeFilter] = useState<EmailTypeFilterValue>("all");
  const [dateFilter, setDateFilter] = useState<EmailDateFilterValue>("7d");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedQuery = deferredSearchQuery.trim().toLocaleLowerCase("cs-CZ");
  const referenceNow = new Date(data.referenceNowIso);
  const todayStart = new Date(referenceNow);
  todayStart.setHours(0, 0, 0, 0);
  const sevenDayStart = new Date(todayStart);
  sevenDayStart.setDate(sevenDayStart.getDate() - 6);
  const thirtyDayStart = new Date(todayStart);
  thirtyDayStart.setDate(thirtyDayStart.getDate() - 29);
  const filteredEmails = data.recentEmails.filter((email) => {
    if (statusFilter !== "all" && email.statusValue !== statusFilter) {
      return false;
    }

    if (typeFilter !== "all" && email.typeValue !== typeFilter) {
      return false;
    }

    if (dateFilter !== "all") {
      const createdAtTime = Date.parse(email.createdAtIso);

      if (Number.isNaN(createdAtTime)) {
        return false;
      }

      if (dateFilter === "today" && createdAtTime < todayStart.getTime()) {
        return false;
      }

      if (dateFilter === "7d" && createdAtTime < sevenDayStart.getTime()) {
        return false;
      }

      if (dateFilter === "30d" && createdAtTime < thirtyDayStart.getTime()) {
        return false;
      }
    }

    if (!normalizedQuery) {
      return true;
    }

    return [
      email.typeLabel,
      email.statusLabel,
      email.recipientLabel,
      email.recipientEmail,
      email.bookingSummary ?? "",
      email.errorMessage ?? "",
    ]
      .join(" ")
      .toLocaleLowerCase("cs-CZ")
      .includes(normalizedQuery);
  });

  return (
    <div className="space-y-4">
      <EmailHealthPanel data={data} />

      <AdminPanel
        title="Poslední emaily"
        description="Přehled posledních emailů a jejich stavu."
        compact
        denseHeader
        tighter
      >
        <div className="space-y-3">
          <EmailFilters
            resultCount={filteredEmails.length}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
          />
          <RecentEmailList emails={filteredEmails} />
        </div>
      </AdminPanel>

      <EmailQueueDebugSection data={data} />
    </div>
  );
}

function EmailHealthPanel({ data }: { data: EmailLogsDashboardData }) {
  return (
    <section
      className={`rounded-[var(--radius-panel)] border p-4 backdrop-blur-xl sm:p-5 ${healthToneStyles[data.health.tone]}`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.68rem] uppercase tracking-[0.24em] text-white/52">
              Health stav
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.18em] ${healthBadgeStyles[data.health.tone]}`}
            >
              {data.health.tone === "ok"
                ? "OK"
                : data.health.tone === "warning"
                  ? "Warning"
                  : "Error"}
            </span>
          </div>
          <h3 className="mt-2.5 font-display text-[1.45rem] leading-tight text-white sm:text-[1.75rem]">
            {data.health.title}
          </h3>
          <p className="mt-1.5 text-sm leading-5 text-white/76">{data.health.helper}</p>
          <p className="mt-2 text-sm leading-5 text-white/88">{data.health.summary}</p>
        </div>

        <div className="min-w-0 max-w-xl rounded-[1rem] border border-white/10 bg-black/20 p-3.5">
          <p className="text-[0.68rem] uppercase tracking-[0.18em] text-white/46">
            Poslední relevantní chyba
          </p>
          <p className="mt-1.5 text-sm leading-5 text-white/84">
            {data.health.latestError ?? "Aktuálně bez aktivní chyby v retry nebo failed stavu."}
          </p>
        </div>
      </div>
    </section>
  );
}

function EmailFilters({
  resultCount,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  dateFilter,
  setDateFilter,
}: {
  resultCount: number;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  statusFilter: EmailStatusFilterValue;
  setStatusFilter: (value: EmailStatusFilterValue) => void;
  typeFilter: EmailTypeFilterValue;
  setTypeFilter: (value: EmailTypeFilterValue) => void;
  dateFilter: EmailDateFilterValue;
  setDateFilter: (value: EmailDateFilterValue) => void;
}) {
  return (
    <div className="rounded-[1rem] border border-white/8 bg-[#151219]/95 px-3 py-2.5 backdrop-blur">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(0,2.4fr)_minmax(10rem,0.95fr)_minmax(11rem,1fr)_minmax(8rem,0.8fr)_auto] xl:items-end">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
            Hledání
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Příjemce, klientka, email, rezervace, chyba"
            className="mt-1.5 h-10 w-full rounded-[0.9rem] border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[var(--color-accent)]/60"
          />
        </label>

        <FilterSelect
          label="Stav"
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as EmailStatusFilterValue)}
        >
          <option value="all" className="text-black">Vše</option>
          <option value="sent" className="text-black">Odesláno</option>
          <option value="pending" className="text-black">Čeká</option>
          <option value="processing" className="text-black">Zpracovává se</option>
          <option value="retry" className="text-black">Retry</option>
          <option value="failed" className="text-black">Selhalo</option>
        </FilterSelect>

        <FilterSelect
          label="Typ emailu"
          value={typeFilter}
          onChange={(value) => setTypeFilter(value as EmailTypeFilterValue)}
        >
          <option value="all" className="text-black">Vše</option>
          <option value="booking_received" className="text-black">Přijetí rezervace</option>
          <option value="booking_confirmation" className="text-black">Potvrzení rezervace</option>
          <option value="reminder" className="text-black">Reminder</option>
          <option value="cancellation" className="text-black">Zrušení</option>
          <option value="reschedule" className="text-black">Přesun termínu</option>
          <option value="voucher" className="text-black">Voucher</option>
          <option value="admin" className="text-black">Admin notifikace</option>
          <option value="other" className="text-black">Ostatní</option>
        </FilterSelect>

        <FilterSelect
          label="Datum"
          value={dateFilter}
          onChange={(value) => setDateFilter(value as EmailDateFilterValue)}
        >
          <option value="all" className="text-black">Vše</option>
          <option value="today" className="text-black">Dnes</option>
          <option value="7d" className="text-black">7 dní</option>
          <option value="30d" className="text-black">30 dní</option>
        </FilterSelect>

        <div className="flex items-end justify-end xl:justify-start">
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
              setTypeFilter("all");
              setDateFilter("7d");
            }}
            className="inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-sm text-white/74 transition hover:border-white/18 hover:bg-white/6 hover:text-white"
          >
            Vymazat
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-2 text-sm text-white/58">
        <p>
          Výsledky: <span className="font-medium text-white">{resultCount}</span>
        </p>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-[0.9rem] border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
      >
        {children}
      </select>
    </label>
  );
}

function RecentEmailList({
  emails,
}: {
  emails: AdminEmailLogsWorkspaceProps["data"]["recentEmails"];
}) {
  if (emails.length === 0) {
    return (
      <div className="rounded-[1.25rem] border border-dashed border-white/14 bg-white/4 p-5">
        <p className="text-base font-medium text-white">Žádné emaily neodpovídají vybranému filtru.</p>
        <p className="mt-2 text-sm leading-6 text-white/62">
          Zkus upravit stav, typ nebo hledání příjemce.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {emails.map((email) => (
        <article
          key={email.id}
          className="rounded-[1.1rem] border border-white/8 bg-white/5 px-3.5 py-3"
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <EmailTypeBadge label={email.typeLabel} tone={email.typeValue} />
                <EmailStatusBadge label={email.statusLabel} tone={email.statusValue} />
                <EmailTrackingBadge email={email} />
              </div>

              <div className="mt-2.5 grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(18rem,0.95fr)]">
                <div className="min-w-0">
                  <p className="text-[0.66rem] uppercase tracking-[0.18em] text-white/42">Klientka / příjemce</p>
                  <p className="mt-1 text-sm font-medium leading-5 text-white">{email.recipientLabel}</p>
                  <p className="mt-0.5 text-sm leading-5 text-white/58">{email.activityLabel}</p>
                </div>

                <div className="min-w-0">
                  <p className="text-[0.66rem] uppercase tracking-[0.18em] text-white/42">Související rezervace</p>
                  {email.bookingSummary ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-sm leading-5 text-white/84">{email.bookingSummary}</p>
                      {email.bookingHref ? (
                        <Link
                          href={email.bookingHref}
                          className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/74 transition hover:border-white/18 hover:text-white"
                        >
                          Otevřít rezervaci
                        </Link>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm leading-5 text-white/58">Bez rezervace</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:min-w-[18rem]">
                  <CompactMeta label="Vytvořeno" value={email.createdAtLabel} />
                  <CompactMeta label="Odesláno" value={email.sentAtLabel} />
                  <CompactMeta label="Pokusy" value={`${email.attemptCount}×`} />
                  {email.statusValue === "pending" || email.statusValue === "retry" ? (
                    <CompactMeta label="Další pokus" value={email.nextAttemptLabel} />
                  ) : null}
                </div>
              </div>

              {(email.statusValue === "failed" || email.statusValue === "retry") && email.errorMessage ? (
                <EmailErrorDetail email={email} />
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap gap-2 xl:w-[11rem] xl:flex-col">
              {email.bookingHref ? (
                <Link
                  href={email.bookingHref}
                  className="inline-flex items-center justify-center rounded-full border border-white/10 px-3.5 py-2 text-sm text-white/78 transition hover:border-white/18 hover:text-white"
                >
                  Otevřít rezervaci
                </Link>
              ) : null}
              <Link
                href={email.detailHref}
                className="inline-flex items-center justify-center rounded-full border border-white/10 px-3.5 py-2 text-sm text-white/78 transition hover:border-white/18 hover:text-white"
              >
                Detail emailu
              </Link>
              {email.canRetry ? (
                <form action={retryEmailLogAction}>
                  <input type="hidden" name="emailLogId" value={email.id} />
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center rounded-full bg-[var(--color-accent)] px-3.5 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
                  >
                    Zkusit znovu
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function CompactMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.9rem] border border-white/8 bg-black/18 px-2.5 py-2">
      <p className="text-[0.62rem] uppercase tracking-[0.16em] text-white/38">{label}</p>
      <p className="mt-0.5 text-xs leading-[1.15rem] text-white/84">{value}</p>
    </div>
  );
}

function EmailTrackingBadge({
  email,
}: {
  email: AdminEmailLogsWorkspaceProps["data"]["recentEmails"][number];
}) {
  if (email.trackingOpenedLabel !== "Připraveno" || email.trackingClickedLabel !== "Připraveno") {
    return null;
  }

  return (
    <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[0.62rem] font-medium text-white/54">
      Tracking připraven
    </span>
  );
}

function EmailErrorDetail({
  email,
}: {
  email: AdminEmailLogsWorkspaceProps["data"]["recentEmails"][number];
}) {
  return (
    <div className="mt-3 rounded-[1rem] border border-red-300/18 bg-red-400/8 p-3.5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div>
          <p className="text-[0.66rem] uppercase tracking-[0.18em] text-red-50/70">Poslední chyba</p>
          <p className="mt-1.5 text-sm leading-5 text-red-50">{email.errorMessage}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <CompactMeta label="Typ emailu" value={email.typeLabel} />
          <CompactMeta label="Příjemce" value={email.recipientEmail} />
          <CompactMeta label="Poslední pokus" value={email.lastAttemptLabel} />
          {email.statusValue === "retry" || email.statusValue === "pending" ? (
            <CompactMeta label="Další pokus" value={email.nextAttemptLabel} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EmailStatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: AdminEmailLogsWorkspaceProps["data"]["recentEmails"][number]["statusValue"];
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.18em] ${statusBadgeStyles[tone]}`}
    >
      {label}
    </span>
  );
}

function EmailTypeBadge({
  label,
  tone,
}: {
  label: string;
  tone: AdminEmailLogsWorkspaceProps["data"]["recentEmails"][number]["typeValue"];
}) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.18em] ${typeBadgeStyles[tone]}`}
    >
      {label}
    </span>
  );
}

function EmailQueueDebugSection({ data }: { data: EmailLogsDashboardData }) {
  const queueHeadline =
    data.pendingItems.length === 0 && data.retryingItems.length === 0 && data.failedItems.length === 0
      ? "Fronta čistá"
      : "Fronta aktivní";

  return (
    <AdminPanel
      title="Technický stav fronty"
      description="Kompaktní souhrn fronty a workeru."
      compact
      denseHeader
      tighter
    >
      <div className="space-y-3">
        <div className="rounded-[1rem] border border-white/8 bg-black/20 px-3.5 py-3">
          <p className="text-sm text-white/82">
            {queueHeadline} {" · "}Retry {data.retryingItems.length} {" · "}Failed{" "}
            {data.failedItems.length} {" · "}
            {data.workerSummary}
          </p>
        </div>

        <details className="group rounded-[1rem] border border-white/8 bg-white/[0.03]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-sm font-medium text-white/78 [&::-webkit-details-marker]:hidden">
            <span>Detail fronty</span>
            <span className="text-xs text-white/46 transition group-open:rotate-180">⌄</span>
          </summary>

          <div className="space-y-3 border-t border-white/8 px-3.5 py-3">
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              {data.queueStats.map((stat) => (
                <article
                  key={stat.label}
                  className={`rounded-[0.95rem] border px-3 py-2.5 ${queueStatToneStyles[stat.tone ?? "default"]}`}
                >
                  <p className="text-[0.62rem] uppercase tracking-[0.16em] text-white/40">{stat.label}</p>
                  <p className="mt-1.5 font-display text-[1.45rem] leading-none">{stat.value}</p>
                  {stat.detail ? (
                    <p className="mt-1.5 text-xs leading-5 text-white/60">{stat.detail}</p>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="rounded-[0.95rem] border border-white/8 bg-black/20 p-3">
              <p className="text-[0.66rem] uppercase tracking-[0.18em] text-white/42">Worker stav</p>
              <p className="mt-1.5 text-sm leading-5 text-white/82">{data.workerSummary}</p>
            </div>

            <div className="grid gap-3 xl:grid-cols-3">
              <AdminPanel title="Pending fronta" description="Čeká na první průchod." compact denseHeader tighter>
                <AdminKeyValueList
                  items={data.pendingItems}
                  emptyTitle="Žádné pending emaily."
                  emptyDescription="Fronta je čistá."
                />
              </AdminPanel>

              <AdminPanel title="Retry pokusy" description="Čekají na další pokus." compact denseHeader tighter>
                <AdminKeyValueList
                  items={data.retryingItems}
                  emptyTitle="Žádné retry emaily."
                  emptyDescription="Retry fronta je prázdná."
                />
              </AdminPanel>

              <AdminPanel title="Poslední chyby" description="Záznamy ke kontrole." compact denseHeader tighter>
                <AdminKeyValueList
                  items={data.failedItems}
                  emptyTitle="Žádné failed emaily."
                  emptyDescription="Bez čerstvých chyb."
                />
              </AdminPanel>
            </div>
          </div>
        </details>
      </div>
    </AdminPanel>
  );
}
