import { notFound } from "next/navigation";
import { AdminRole } from "@/generated/prisma/client";

import {
  publishVoucherTemplateAction,
  sendTestVoucherTemplateEmailAction,
} from "@/features/admin/actions/voucher-template-actions";
import { AdminPageShell } from "@/features/admin/components/admin-page-shell";
import { AdminVoucherTabs } from "@/features/admin/components/admin-voucher-stock-pages";
import { VoucherTemplateLayoutEditor } from "@/features/admin/components/voucher-template-layout-editor";
import { VoucherTemplateOverflowMenu } from "@/features/admin/components/voucher-template-overflow-menu";
import { AdminStatePill } from "@/features/admin/components/admin-state-pill";
import { VoucherTemplatePublishedPreview } from "@/features/admin/components/voucher-template-published-preview";
import { voucherTemplateStoredLayoutSchema } from "@/features/vouchers/lib/voucher-template-layout";
import { VoucherTemplateGraphicsUpload } from "@/features/admin/components/voucher-template-graphics-upload";
import { voucherTemplateUploadErrorMessage } from "@/features/admin/lib/voucher-template-upload-error";
import { preflightVoucherTemplateMaster, type VoucherTemplatePreflight } from "@/features/vouchers/lib/voucher-template-preflight";
import { CURRENT_VOUCHER_TEMPLATE_VALIDATION_POLICY } from "@/features/vouchers/lib/voucher-template-validation-policy";
import { loadVoucherTemplateMaster, requireVoucherTemplateById } from "@/features/vouchers/lib/voucher-template-repository";
import { requireRole } from "@/lib/auth/session";

export default async function VoucherTemplateDetailPage({ params, searchParams }: { params: Promise<{ templateId: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireRole([AdminRole.OWNER]);
  let template;
  try {
    template = await requireVoucherTemplateById((await params).templateId);
  } catch {
    notFound();
  }

  const templateId = template.id;
  const requestedError = (await searchParams).error;
  const overflowLabel = requestedError?.match(/^Dynamický text se nevejde do oblasti „(Hodnota|Služba|Platnost|Kód)“ ani při minimální velikosti písma\.$/)?.[1];
  // A query-string error describes a past action, not the published layout.
  const error = template.status !== "DRAFT" && overflowLabel ? undefined : requestedError;
  const errorMessage = error ? voucherTemplateUploadErrorMessage(error) : undefined;
  let preflight: VoucherTemplatePreflight | null = null;
  let graphicsError: string | null = null;
  if (template.masterStoragePath) {
    try {
      preflight = await preflightVoucherTemplateMaster(await loadVoucherTemplateMaster(template));
      graphicsError = preflight.errors[0] ? voucherTemplateUploadErrorMessage(preflight.errors[0]) : null;
    } catch {
      graphicsError = "Grafiku se nepodařilo načíst a zkontrolovat. Zkuste stránku obnovit.";
    }
  }
  const graphicsValid = preflight !== null && preflight.errors.length === 0;
  const printReady = graphicsValid && template.status === "PUBLISHED" && template.validationPolicy === CURRENT_VOUCHER_TEMPLATE_VALIDATION_POLICY;
  const graphicsLabel = !template.masterStoragePath ? "Grafika zatím není nahraná" : graphicsValid ? printReady ? "Připraveno pro tisk" : "Grafika prošla kontrolou" : "Grafika vyžaduje kontrolu";
  const statusLabel = template.status === "DRAFT" ? "Draft" : template.status === "PUBLISHED" ? "Publikováno" : "Neaktivní";
  const statusDescription = template.status === "DRAFT" ? "v přípravě" : template.status === "PUBLISHED" ? "publikovaná" : "neaktivní";
  const statusTone = template.status === "DRAFT" ? "accent" : template.status === "PUBLISHED" ? "active" : "muted";
  const previewUrl = template.previewStoragePath && template.masterSha256
    ? `/api/admin/voucher-templates/${template.id}/preview?v=${template.updatedAt.getTime()}`
    : undefined;

  return (
    <AdminPageShell
      eyebrow="Vouchery / Šablony"
      title={template.label}
      description={`${template.key} · verze šablony ${statusDescription}`}
      denseIntro
      headerActions={
        <div className="flex flex-wrap justify-end gap-2">
          <VoucherTemplateOverflowMenu templateId={templateId} canDelete={template.status === "DRAFT"} canDeactivate={template.status === "PUBLISHED"} />
        </div>
      }
    >
      <div className="space-y-5">
        {errorMessage ? <div role="alert" className="rounded-2xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{overflowLabel ? <><p>Publikace se nezdařila: text v oblasti „{overflowLabel}“ potřebuje více místa.</p><p className="mt-2 text-xs leading-5">V editoru vyberte „{overflowLabel}“ a otevřete „Přizpůsobení textu“. Upravte povolený počet řádků nebo nejmenší písmo; podle potřeby zvětšete šířku či výšku oblasti. Náhled ukáže výsledek kontroly. Poté změny uložte a publikaci zopakujte.</p><a href="#umisteni" className="mt-3 inline-flex font-semibold underline underline-offset-4">Přejít k úpravě textu</a></> : errorMessage}{error && (overflowLabel || errorMessage !== error) ? <details className="mt-2 text-xs"><summary className="cursor-pointer">Technické detaily</summary><p className="mt-2">{error}</p></details> : null}</div> : null}
        <AdminVoucherTabs area="owner" active="templates" />
        <ol aria-label="Postup přípravy voucheru" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/65">
          <li><a href="#grafika" className="hover:text-white">1. Grafika{graphicsValid ? " ✓" : ""}</a></li>
          <li><a href="#umisteni" className="hover:text-white">2. Umístění údajů</a></li>
          <li><a href="#publikace" className="hover:text-white">3. Publikace{printReady ? " ✓" : ""}</a></li>
        </ol>
        <section id="grafika" className="scroll-mt-6 rounded-[var(--radius-panel)] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-white">Grafika voucheru</h2>
            <AdminStatePill tone={statusTone}>{statusLabel}</AdminStatePill>
          </div>
          <div className="mt-3">
            <AdminStatePill tone={graphicsValid ? "active" : graphicsError ? "warning" : "muted"}>{graphicsLabel}</AdminStatePill>
            <p className="mt-2 text-xs text-white/65">{!template.masterStoragePath ? "Nahrajte PDF exportované z Affinity." : graphicsError ?? "Rozměr, spadávka a tiskový PDF profil jsou v pořádku."}</p>
          </div>
          {template.status === "DRAFT" ? <VoucherTemplateGraphicsUpload templateId={template.id} hasGraphics={!!template.masterStoragePath} /> : null}
          {preflight ? <details className="mt-4 text-xs text-white/55">
            <summary className="cursor-pointer font-semibold">Technické detaily</summary>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt>PDF profil</dt><dd>{preflight.pdfXClaim ?? "Neuveden"} · {preflight.pdfXVerification === "STRUCTURALLY_VALIDATED" ? "interní kontrola splněna" : "interní kontrola nesplněna"}</dd>
              <dt>Rozměr souboru</dt><dd>{formatBoxSize(preflight.mediaBox)}</dd>
              <dt>TrimBox</dt><dd>{formatBoxSize(preflight.trimBox)}</dd>
              <dt>Spadávka</dt><dd>{preflight.geometryValid ? "3 mm na každé straně" : "Neodpovídá požadované geometrii"}</dd>
              <dt>ICC / OutputIntent</dt><dd>{preflight.iccProfileValid && preflight.outputIntentValid ? "V pořádku" : "Chybí nebo není platný"}{preflight.outputConditionIdentifier ? ` · ${preflight.outputConditionIdentifier}` : ""}</dd>
            </dl>
            {preflight.errors.length ? <ul className="mt-3 list-disc space-y-1 pl-4">{preflight.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}
          </details> : null}
          {template.status !== "DRAFT" ? <div className="mt-4 border-t border-white/10 pt-4"><p className="text-sm text-white/60">{template.status === "PUBLISHED" ? "Publikovaná verze zůstává neměnná. Pro další úpravy vytvořte novou verzi. Pokud ji už nechcete používat pro nové vouchery, můžete ji deaktivovat v nabídce dalších akcí." : "Neaktivní verze zůstává zachovaná pro již vystavené a vytištěné vouchery. Pro nové použití vytvořte novou verzi."}</p></div> : null}
        </section>
        <div id="umisteni" className="scroll-mt-6">
          {template.status === "DRAFT" ? <VoucherTemplateLayoutEditor key={`${template.masterSha256 ?? "empty"}:${template.previewStoragePath ?? "empty"}`} templateId={template.id} initialLayout={voucherTemplateStoredLayoutSchema.parse(template.layout)} initialUpdatedAt={template.updatedAt.toISOString()} previewSrc={previewUrl} hasGraphics={!!template.masterStoragePath} /> : <section className="grid gap-5 rounded-[var(--radius-panel)] border border-white/10 bg-white/[0.035] p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.8fr)] md:items-start"><VoucherTemplatePublishedPreview src={previewUrl} alt={`Náhled šablony ${template.label}`} layout={voucherTemplateStoredLayoutSchema.parse(template.layout)} /><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">{statusLabel} verze</p><h3 className="mt-2 font-display text-2xl text-white">Umístění údajů je uzamčené</h3><p className="mt-3 text-sm leading-6 text-white/65">Vzhled této verze zůstává zachovaný pro vystavené vouchery. Pro úpravu umístění údajů vytvořte novou verzi.</p><details className="mt-5"><summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Technické detaily umístění</summary><pre className="mt-3 max-h-64 overflow-auto rounded-xl border border-white/8 bg-black/20 p-3 text-xs text-white/55">{JSON.stringify(template.layout, null, 2)}</pre></details></div></section>}
        </div>
        <section id="publikace" className="scroll-mt-6 border-t border-white/10 pt-5">
          <h2 className="text-sm font-semibold text-white">Publikace</h2>
          {template.status === "DRAFT" ? <>
            <p className="mt-2 text-sm text-white/65">Uložte změny a zkontrolujte PDF pro tisk. Poté šablonu publikujte. Při publikaci proběhne finální tisková kontrola uložené verze.</p>
            <form action={publishVoucherTemplateAction.bind(null, template.id)} className="mt-3"><button disabled={!graphicsValid} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">Publikovat</button></form>
            <details className="mt-4"><summary className="cursor-pointer text-xs font-semibold text-white/55">Poslat testovací e-mail</summary>
              <form action={sendTestVoucherTemplateEmailAction} className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-end"><input type="hidden" name="templateId" value={template.id} /><label className="min-w-0 flex-1 text-xs text-white/65">Testovací e-mail<input required type="email" name="recipientEmail" placeholder="např. studio@ppstudio.cz" className="mt-1 min-h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-[var(--color-accent)]/70" /></label><button className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:text-white">Odeslat test</button></form>
            </details>
          </> : <p className="mt-2 text-sm text-white/65">{printReady ? "Šablona je publikovaná a připravená pro tisk voucherů." : "Tato verze zůstává zachovaná pro existující vouchery. Pro nové použití vytvořte novou verzi a publikujte ji po kontrole."}</p>}
        </section>
      </div>
    </AdminPageShell>
  );
}

function formatBoxSize(box: VoucherTemplatePreflight["mediaBox"]) {
  return box ? `${(box.width * 25.4 / 72).toFixed(2)} × ${(box.height * 25.4 / 72).toFixed(2)} mm` : "Neuveden";
}
