import { AdminPanel } from "@/features/admin/components/admin-page-shell";
import type { MetaAdsCostReport } from "@/features/admin/lib/meta-ads-reporting";

const number = new Intl.NumberFormat("cs-CZ");

function formatSpend(value: number, currency: string | null) {
  if (!currency) return "—";
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.045] p-4">
    <p className="text-xs font-semibold text-white/75">{label}</p>
    <p className="mt-2 break-words font-display text-xl tabular-nums text-white sm:text-2xl">{value}</p>
  </div>;
}

export function MetaAdsCostPanel({ report }: { report: MetaAdsCostReport }) {
  const description = "Automaticky z Meta Marketing API; rezervace podle dne vytvoření, nikoli termínu návštěvy.";

  if (report.status !== "ok") {
    const message = report.status === "disabled"
      ? "Automatický přehled čeká na serverové nastavení META_ADS_ACCOUNT_ID a META_ADS_ACCESS_TOKEN."
      : report.status === "future"
        ? "Výdaje za budoucí období nejsou dostupné."
        : "Meta Ads Insights nejsou právě dostupné. Zkontrolujte platnost tokenu, oprávnění ads_read a dostupnost API.";
    return <AdminPanel title="Meta reklamy · cena za rezervaci" description={description} compact denseHeader>
      <p className="mt-3 text-sm leading-6 text-white/65">{message}</p>
    </AdminPanel>;
  }

  return <AdminPanel title="Meta reklamy · cena za rezervaci" description={description} compact denseHeader>
    <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Útrata reklamního účtu" value={report.hasSpendData ? formatSpend(report.spend, report.currency) : "Bez záznamu"} />
      <Metric label="Aktivní rezervace z placených reklam" value={number.format(report.bookings)} />
      <Metric label="Cena za aktivní rezervaci" value={report.hasSpendData && report.costPerBooking !== null ? formatSpend(report.costPerBooking, report.currency) : "—"} />
      <Metric label="Cena za dokončenou návštěvu" value={report.hasSpendData && report.costPerCompleted !== null ? formatSpend(report.costPerCompleted, report.currency) : "—"} />
    </div>
    <p className="mt-3 text-xs leading-5 text-white/60">
      Započítávají se jen webové rezervace označené Instagram/Facebook a placeným médiem
      (např. mtm_medium=paid_social). Aktivní = čeká, potvrzena nebo dokončena.
      Dokončené návštěvy: {number.format(report.completed)}.
      Útrata zahrnuje všechny kampaně vybraného Meta reklamního účtu.
      Rezervace bez správně označeného odkazu nebo vytvořené přes zprávy nemusí být rozpoznané.
      Výpočet je orientační a nepředstavuje atribuci vykazovanou samotnou Metou.
      Počet dokončených návštěv se může zpětně zvýšit.
      Útrata se aktualizuje automaticky s cache nejvýše 1 hodina.
    </p>
  </AdminPanel>;
}
