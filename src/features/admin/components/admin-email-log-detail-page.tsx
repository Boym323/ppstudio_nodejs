import Link from "next/link";

import {
  releaseStuckEmailLogAction,
  resendEmailLogAction,
  retryEmailLogAction,
} from "../actions/email-log-actions";
import { EmailIncidentResolutionForm } from "./email-incident-resolution-form";
import { type EmailLogDetailData } from "../lib/data/email-logs";
import { AdminPageShell, AdminPanel } from "./admin-page-shell";

type AdminEmailLogDetailPageProps = {
  data: EmailLogDetailData;
  flashMessage?: string;
};

const statusBadgeStyles: Record<EmailLogDetailData["finalStatus"], string> = {
  sent: "border-emerald-300/30 bg-emerald-400/12 text-emerald-50",
  pending: "border-white/14 bg-white/8 text-white",
  retry: "border-amber-300/30 bg-amber-400/12 text-amber-50",
  failed: "border-red-300/30 bg-red-400/12 text-red-50",
};

export function AdminEmailLogDetailPage({ data, flashMessage }: AdminEmailLogDetailPageProps) {
  const technicalData = {
    id: data.id,
    finalStatus: data.finalStatusLabel,
    queueState: data.queueStateLabel,
    provider: data.providerLabel,
    providerMessageId: data.providerMessageIdLabel,
    templateKey: data.templateKey,
    attemptCount: data.attemptCount,
    createdAt: data.createdAtLabel,
    updatedAt: data.updatedAtLabel,
    processingStartedAt: data.processingStartedLabel,
    nextAttemptAt: data.nextAttemptLabel,
    sentAt: data.sentAtLabel,
    errorMessage: data.errorMessage,
    transportStatus: data.transportStatusLabel,
    actionToken: data.actionTokenLabel,
    actionTokenSummary: data.actionTokenSummary,
    actionTokenId: data.actionTokenId,
  };

  return (
    <AdminPageShell
      eyebrow="E-mailový provoz"
      title="Detail e-mailu"
      description=""
      compact
      denseIntro
    >
      {flashMessage ? (
        <div className="rounded-[1rem] border border-emerald-300/20 bg-emerald-400/10 px-3.5 py-2.5 text-sm leading-5 text-emerald-50">
          {flashMessage}
        </div>
      ) : null}

      <EmailDetailHeader data={data} />
      {data.errorSummary ? <EmailErrorPanel data={data} /> : null}
      <EmailQuickActions data={data} />

      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-4">
          <EmailLinkedEntities data={data} />
        </div>

        <div className="space-y-4">
          <EmailSummaryGrid data={data} />
        </div>
      </div>

      <EmailTechnicalDetails data={data} technicalData={technicalData} />
    </AdminPageShell>
  );
}

function EmailDetailHeader({ data }: { data: EmailLogDetailData }) {
  return (
    <section className="rounded-[var(--radius-panel)] border border-white/10 bg-white/6 p-4 backdrop-blur-xl sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-semibold leading-tight text-white sm:text-xl">
              {data.businessTitle}
            </h2>
            <EmailStatusBadge status={data.finalStatus} label={data.finalStatusLabel} />
          </div>
          <p className="mt-2 text-sm leading-5 text-white/68">{data.finalStatusDetail}</p>
        </div>

        <div className="rounded-[1rem] border border-white/10 bg-black/20 px-3.5 py-2.5 text-right">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/48">{data.headerTimestampTitle}</p>
          <p className="mt-1.5 text-sm font-medium text-white">{data.headerTimestampLabel}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <HeaderFact label="Příjemce" value={data.recipientEmail} />
        <HeaderFact label="Klientka" value={data.clientName} />
      </div>
    </section>
  );
}

function EmailStatusBadge({
  status,
  label,
}: {
  status: EmailLogDetailData["finalStatus"];
  label: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] ${statusBadgeStyles[status]}`}
    >
      {label}
    </span>
  );
}

function EmailQuickActions({ data }: { data: EmailLogDetailData }) {
  const retryHint = getRetryHint(data);

  return (
    <AdminPanel title="Akce" compact denseHeader tighter>
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/email-logy"
            className="rounded-full border border-white/10 px-3.5 py-2 text-sm text-white/78 transition hover:border-white/30 hover:text-white"
          >
            Zpět na přehled
          </Link>

          {data.bookingHref ? (
            <Link
              href={data.bookingHref}
              className="rounded-full border border-white/10 px-3.5 py-2 text-sm text-white/78 transition hover:border-white/30 hover:text-white"
            >
              Otevřít rezervaci
            </Link>
          ) : null}

          {data.canRetry ? (
            <form action={retryEmailLogAction}>
              <input type="hidden" name="emailLogId" value={data.id} />
              <button
                type="submit"
                className="rounded-full bg-[var(--color-accent)] px-3.5 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
              >
                Zkusit znovu
              </button>
            </form>
          ) : null}

          {data.canResend ? (
            <form action={resendEmailLogAction}>
              <input type="hidden" name="emailLogId" value={data.id} />
              <button
                type="submit"
                className="rounded-full border border-[var(--color-accent)]/42 bg-[var(--color-accent)]/12 px-3.5 py-2 text-sm font-semibold text-[var(--color-accent-soft)] transition hover:border-[var(--color-accent)]/68 hover:bg-[var(--color-accent)]/20"
              >
                Znovu odeslat e-mail
              </button>
            </form>
          ) : null}

          {data.canRelease ? (
            <form action={releaseStuckEmailLogAction}>
              <input type="hidden" name="emailLogId" value={data.id} />
              <button
                type="submit"
                className="rounded-full border border-white/12 bg-white/5 px-3.5 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
              >
                Uvolnit zaseknutý job
              </button>
            </form>
          ) : null}

          {data.canCloseIncident ? <EmailIncidentResolutionForm emailLogId={data.id} /> : null}
        </div>

        <p className="text-sm leading-5 text-white/66 lg:max-w-[30rem] lg:text-right">{retryHint}</p>
      </div>

      {data.incidentResolution ? (
        <div className="mt-3 rounded-[0.9rem] border border-emerald-300/20 bg-emerald-400/[0.07] px-3.5 py-2.5 text-sm text-emerald-50">
          <p className="font-semibold">{data.incidentResolution.label}</p>
          <p className="mt-1 text-emerald-50/78">{data.incidentResolution.detail}</p>
        </div>
      ) : null}
    </AdminPanel>
  );
}

function EmailSummaryGrid({ data }: { data: EmailLogDetailData }) {
  const items = [
    { label: "Typ emailu", value: data.typeLabel },
    { label: "Doručení příjemci", value: data.deliveryStatusLabel },
    { label: "Poslední pokus", value: data.lastAttemptLabel },
    { label: "Odesláno", value: data.sentAtLabel },
  ];

  return (
    <AdminPanel title="Souhrn e-mailu" compact denseHeader tighter className="h-full">
      <dl className="divide-y divide-white/8">
        {items.map((item) => (
          <div key={item.label} className="grid gap-1 py-1.5 sm:grid-cols-[6.8rem_minmax(0,1fr)] sm:items-start sm:gap-3">
            <dt className="text-xs text-white/60">{item.label}</dt>
            <dd className="text-sm leading-[1.2rem] text-white/88">{item.value}</dd>
          </div>
        ))}
      </dl>
    </AdminPanel>
  );
}

function EmailLinkedEntities({ data }: { data: EmailLogDetailData }) {
  return (
    <AdminPanel title="Navázané záznamy" compact denseHeader tighter className="h-full">
      <div className="divide-y divide-white/8">
        <LinkedEntityRow
          label="Rezervace"
          title={data.bookingTitle}
          detail={data.bookingScheduleLabel}
          href={data.bookingHref}
        />
        <LinkedEntityRow label="Klientka" title={data.clientName} detail={data.clientSummary} />
      </div>
    </AdminPanel>
  );
}

function EmailTechnicalDetails({
  data,
  technicalData,
}: {
  data: EmailLogDetailData;
  technicalData: Record<string, unknown>;
}) {
  return (
      <details className="group rounded-[1rem] border border-white/10 bg-white/[0.03]">
        <summary className="list-none cursor-pointer px-3.5 py-3 text-sm font-medium text-white transition hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Zobrazit technické detaily</span>
          <span className="hidden group-open:inline">Skrýt technické detaily</span>
        </summary>

        <div className="space-y-4 border-t border-white/8 p-3.5 pt-4">
          <TechnicalBlock
            title="Raw data"
            description="Maskovaná metadata logu."
            content={stringifyMasked(technicalData)}
          />

          <TechnicalBlock
            title="Payload"
            description="Maskovaný payload předaný šabloně nebo workeru."
            content={data.payload ? stringifyMasked(data.payload) : "Payload není k dispozici."}
          />

          <details className="rounded-[0.95rem] border border-red-300/18 bg-red-400/6">
            <summary className="list-none cursor-pointer px-3.5 py-3 text-sm font-medium text-red-50 [&::-webkit-details-marker]:hidden">
              Zobrazit citlivá data
            </summary>
            <div className="space-y-4 border-t border-red-300/14 p-3.5">
              <TechnicalBlock
                title="Raw data bez maskování"
                description="Používat jen při řešení konkrétního incidentu."
                content={JSON.stringify(technicalData, null, 2)}
              />
              <TechnicalBlock
                title="Payload bez maskování"
                description="Nezkrácená technická data mohou obsahovat tokeny nebo citlivé URL parametry."
                content={data.payload ? JSON.stringify(data.payload, null, 2) : "Payload není k dispozici."}
              />
            </div>
          </details>
        </div>
      </details>
  );
}

function EmailErrorPanel({ data }: { data: EmailLogDetailData }) {
  return (
    <AdminPanel
      title="Poslední chyba"
      compact
      denseHeader
      tighter
    >
      <div className="grid gap-3">
        <div className="rounded-[1rem] border border-red-300/20 bg-red-400/10 p-3.5">
          <p className="text-[10px] uppercase tracking-[0.18em] text-red-100/75">Krátký popis</p>
          <p className="mt-1.5 text-sm leading-5 text-red-50">{data.errorSummary}</p>

          {data.errorMessage && data.errorMessage !== data.errorSummary ? (
            <details className="mt-3 rounded-[0.95rem] border border-red-300/16 bg-black/15">
              <summary className="list-none cursor-pointer px-3.5 py-3 text-sm font-medium text-red-50 [&::-webkit-details-marker]:hidden">
                Zobrazit detail chyby
              </summary>
              <pre className="overflow-auto border-t border-red-300/14 p-3.5 text-xs leading-5 text-red-50/92">
                {data.errorMessage}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </AdminPanel>
  );
}

function HeaderFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 py-1">
      <p className="text-xs text-white/60">{label}</p>
      <p className="mt-1 text-sm leading-5 text-white/88">{value}</p>
    </div>
  );
}

function LinkedEntityRow({
  label,
  title,
  detail,
  href,
  sensitiveValue,
}: {
  label: string;
  title: string;
  detail: string;
  href?: string | null;
  sensitiveValue?: string | null;
}) {
  return (
    <div className="grid gap-2 py-2.5 md:grid-cols-[7rem_minmax(0,1fr)_auto] md:items-start md:gap-3">
      <p className="pt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/48">{label}</p>

      <div className="min-w-0">
        <p className="text-sm font-medium leading-5 text-white">{title}</p>
        <p className="mt-0.5 text-sm leading-5 text-white/68">{detail}</p>

        {sensitiveValue ? (
          <div className="mt-2">
            <p className="rounded-[0.8rem] border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs leading-5 text-white/76">
              {maskSensitiveValue(sensitiveValue)}
            </p>
            <details className="mt-1.5">
              <summary className="list-none cursor-pointer text-sm font-medium text-[var(--color-accent-soft)] [&::-webkit-details-marker]:hidden">
                Zobrazit celý token
              </summary>
              <p className="mt-1.5 break-all rounded-[0.8rem] border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs leading-5 text-white/76">
                {sensitiveValue}
              </p>
            </details>
          </div>
        ) : null}
      </div>

      {href ? (
        <Link
          href={href}
          className="inline-flex rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white/74 transition hover:border-white/18 hover:text-white md:mt-0.5"
        >
          Otevřít rezervaci
        </Link>
      ) : null}
    </div>
  );
}

function TechnicalBlock({
  title,
  description,
  content,
}: {
  title: string;
  description: string;
  content: string;
}) {
  return (
    <section>
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/46">{title}</p>
      <p className="mt-1.5 text-sm leading-5 text-white/62">{description}</p>
      <pre className="mt-2.5 max-h-[24rem] overflow-auto rounded-[0.95rem] border border-white/10 bg-black/30 p-3 text-xs leading-5 text-white/82">
        {content}
      </pre>
    </section>
  );
}

function getRetryHint(data: EmailLogDetailData) {
  if (data.canRetry) {
    return "Email lze znovu zařadit do fronty. Použijte jen ve chvíli, kdy je potřeba další pokus opravdu spustit.";
  }

  if (data.finalStatus === "sent") {
    return "Email byl úspěšně odeslán, opakování není potřeba.";
  }

  if (data.canRelease) {
    return "Email je právě zamčený ve zpracování. Pokud worker uvízl, můžete job ručně uvolnit.";
  }

  if (data.finalStatus === "pending") {
    return "Email čeká ve frontě na první průchod workeru.";
  }

  return "Tento záznam teď není vhodné ručně opakovat.";
}

function stringifyMasked(value: unknown) {
  return JSON.stringify(maskSensitiveData(value), null, 2);
}

function maskSensitiveData(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveData(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => {
        if (isSensitiveKey(key)) {
          return [key, maskSensitiveValue(entryValue)];
        }

        return [key, maskSensitiveData(entryValue)];
      }),
    );
  }

  if (typeof value === "string") {
    return maskSensitiveString(value);
  }

  return value;
}

function maskSensitiveString(value: string) {
  const maskedInline = value.replace(
    /((?:token|secret|signature|sig|hash|key|code)=)([^&\s]+)/gi,
    (_, prefix: string) => `${prefix}${"•".repeat(6)}`,
  );

  try {
    const url = new URL(value);

    for (const key of Array.from(url.searchParams.keys())) {
      if (isSensitiveKey(key)) {
        url.searchParams.set(key, "••••••");
      }
    }

    return url.toString();
  } catch {
    return maskedInline;
  }
}

function maskSensitiveValue(value: unknown) {
  if (typeof value !== "string" || value.length === 0) {
    return "••••••";
  }

  if (value.length <= 6) {
    return "••••••";
  }

  return `${value.slice(0, 3)}••••••${value.slice(-3)}`;
}

function isSensitiveKey(key: string) {
  return /token|secret|signature|sig|hash|key|code/i.test(key);
}
