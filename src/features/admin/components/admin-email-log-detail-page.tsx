import { EmailLogStatus } from "@prisma/client";
import Link from "next/link";

import { releaseStuckEmailLogAction, retryEmailLogAction } from "../actions/email-log-actions";
import { type EmailLogDetailData } from "../lib/admin-data";
import { AdminPageShell, AdminPanel } from "./admin-page-shell";

type AdminEmailLogDetailPageProps = {
  data: EmailLogDetailData;
  flashMessage?: string;
};

export function AdminEmailLogDetailPage({ data, flashMessage }: AdminEmailLogDetailPageProps) {
  return (
    <AdminPageShell
      eyebrow="Email observability"
      title={data.subject}
      description={`Detail záznamu ${data.id.slice(0, 8).toUpperCase()} • ${data.recipientEmail}`}
      stats={[
        {
          label: "Stav",
          value: data.statusLabel,
          tone: data.status === EmailLogStatus.FAILED ? "accent" : "default",
          detail: data.queueStateLabel,
        },
        {
          label: "Pokusy",
          value: String(data.attemptCount),
          detail: data.canRetry ? "Připraveno k ručnímu retry." : "Aktuální záznam nelze retryovat.",
        },
        {
          label: "Zpracování",
          value: data.isProcessing ? (data.isStuck ? "Zaseknuto" : "Aktivní") : "Volné",
          tone: data.isStuck ? "accent" : "muted",
          detail: data.processingStartedLabel,
        },
        {
          label: "Chyba",
          value: data.errorMessage ? "Ano" : "Ne",
          detail: data.errorMessage ? "Poslední chyba je uložená níže." : "Aktuálně bez uložené chyby.",
        },
      ]}
    >
      {flashMessage ? (
        <div className="rounded-[1.25rem] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-50">
          {flashMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin/email-logy"
          className="rounded-full border border-white/10 px-4 py-3 text-sm text-white/78 transition hover:border-white/30 hover:text-white"
        >
          Zpět na přehled
        </Link>

        {data.canRetry ? (
          <form action={retryEmailLogAction}>
            <input type="hidden" name="emailLogId" value={data.id} />
            <button
              type="submit"
              className="rounded-full bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
            >
              Ruční retry
            </button>
          </form>
        ) : null}

        {data.canRelease ? (
          <form action={releaseStuckEmailLogAction}>
            <input type="hidden" name="emailLogId" value={data.id} />
            <button
              type="submit"
              className="rounded-full border border-white/12 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
            >
              Uvolnit zaseknutý job
            </button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AdminPanel title="Základní údaje" description="Identita logu, stav fronty a provozní metadata." compact>
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Příjemce" value={data.recipientEmail} />
            <DetailRow label="Typ" value={data.typeLabel} />
            <DetailRow label="Šablona" value={data.templateKey} />
            <DetailRow label="Provider" value={data.providerLabel} />
            <DetailRow label="Provider message id" value={data.providerMessageIdLabel} />
            <DetailRow label="Další pokus" value={data.nextAttemptLabel} />
            <DetailRow label="Zpracování od" value={data.processingStartedLabel} />
            <DetailRow label="Odesláno" value={data.sentAtLabel} />
            <DetailRow label="Vytvořeno" value={data.createdAtLabel} />
            <DetailRow label="Aktualizováno" value={data.updatedAtLabel} />
          </dl>
        </AdminPanel>

        <AdminPanel title="Navázané záznamy" description="Souvislosti, které pomáhají dohledat kontext při incidentu." compact>
          <div className="space-y-4">
            <ContextBlock label="Rezervace" value={data.bookingSummary} />
            <ContextBlock label="Klientka" value={data.clientSummary} />
            <ContextBlock label="Token akce" value={data.actionTokenSummary} />
            <ContextBlock label="Stav fronty" value={data.queueStateLabel} />
          </div>
        </AdminPanel>

        <AdminPanel title="Payload" description="Raw payload předaný šabloně e-mailu." compact>
          <pre className="max-h-[34rem] overflow-auto rounded-[1.25rem] border border-white/10 bg-black/30 p-4 text-xs leading-6 text-white/82">
            {data.payload ? JSON.stringify(data.payload, null, 2) : "Payload není k dispozici."}
          </pre>
        </AdminPanel>

        <AdminPanel title="Poslední chyba" description="Text chyby z posledního neúspěšného doručení." compact>
          {data.errorMessage ? (
            <pre className="whitespace-pre-wrap rounded-[1.25rem] border border-red-300/20 bg-red-400/10 p-4 text-sm leading-6 text-red-50">
              {data.errorMessage}
            </pre>
          ) : (
            <div className="rounded-[1.25rem] border border-dashed border-white/14 bg-white/4 p-5">
              <p className="text-sm leading-6 text-white/68">Žádná chyba není uložená.</p>
            </div>
          )}
        </AdminPanel>
      </div>
    </AdminPageShell>
  );
}

type DetailRowProps = {
  label: string;
  value: string;
};

function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4">
      <dt className="text-xs uppercase tracking-[0.24em] text-white/52">{label}</dt>
      <dd className="mt-2 text-sm leading-6 text-white/88">{value}</dd>
    </div>
  );
}

type ContextBlockProps = {
  label: string;
  value: string;
};

function ContextBlock({ label, value }: ContextBlockProps) {
  return (
    <div className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-white/52">{label}</p>
      <p className="mt-2 text-sm leading-6 text-white/82">{value}</p>
    </div>
  );
}
