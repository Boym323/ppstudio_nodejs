"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createServiceCategoryAction,
  updateServiceCategoryAction,
} from "@/features/admin/actions/service-category-actions";
import {
  initialUpdateServiceCategoryActionState,
} from "@/features/admin/actions/update-service-category-action-state";
import { AdminStatePill } from "@/features/admin/components/admin-state-pill";
import {
  pricingIconKeyValues,
  pricingLayoutValues,
} from "@/features/admin/lib/admin-service-category-validation";
import { cn } from "@/lib/utils";

import type { CategoryRecord } from "./types";

type BaseProps = {
  area: "owner" | "salon";
  returnTo: string;
  servicesPath: string;
  onClose?: () => void;
  onSaved?: (category: {
    id: string;
    name: string;
    description: string | null;
    pricingDescription: string | null;
    pricingLayout: "LIST" | "GRID";
    pricingIconKey: "DROPLET" | "EYE_LASHES" | "LOTUS" | "BRUSH" | "LEAF" | "LIPSTICK" | "SPARK";
    sortOrder: number;
    pricingSortOrder: number;
    isActive: boolean;
  }) => void;
};

type CreateProps = BaseProps & {
  mode: "create";
};

type EditProps = BaseProps & {
  mode: "edit";
  category: CategoryRecord;
  isActionPending?: boolean;
  onToggleActive: (nextValue: boolean) => void;
  onDeactivate?: () => void;
};

type Props = CreateProps | EditProps;

export function CategoryDetailPanel(props: Props) {
  const { onSaved } = props;
  const [serverState, formAction] = useActionState(
    props.mode === "create" ? createServiceCategoryAction : updateServiceCategoryAction,
    initialUpdateServiceCategoryActionState,
  );
  const lastReportedId = useRef<string | null>(null);
  const [descriptionLength, setDescriptionLength] = useState(
    props.mode === "create" ? 0 : (props.category.description ?? "").length,
  );
  const formKey = props.mode === "create" ? "create" : props.category.id;

  useEffect(() => {
    if (
      serverState.status === "success" &&
      serverState.category &&
      lastReportedId.current !== serverState.category.id
    ) {
      lastReportedId.current = serverState.category.id;
      onSaved?.(serverState.category);
    }
  }, [onSaved, serverState.category, serverState.status]);

  const servicesHref =
    props.mode === "edit" ? `${props.servicesPath}?category=${props.category.id}` : props.servicesPath;
  const createServiceHref =
    props.mode === "edit"
      ? `${props.servicesPath}?mode=create&category=${props.category.id}`
      : `${props.servicesPath}?mode=create`;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(22,27,34,0.98),rgba(12,16,22,0.99))] shadow-[0_30px_100px_rgba(0,0,0,0.36)]">
      <header className="shrink-0 border-b border-white/8 px-6 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.28em] text-white/36">Detail kategorie</p>
            <h3 className="mt-2 truncate text-[1.1rem] font-medium text-white sm:text-[1.05rem] xl:text-[1.7rem]">
              {props.mode === "create" ? "Nová kategorie" : props.category.name}
            </h3>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {props.mode === "create" ? (
                <>
                  <AdminStatePill tone="accent">Připraveno</AdminStatePill>
                  <AdminStatePill tone="muted">Nová položka</AdminStatePill>
                </>
              ) : (
                <>
                  <AdminStatePill tone={props.category.isActive ? "active" : "muted"}>
                    {props.category.isActive ? "Aktivní" : "Skrytá"}
                  </AdminStatePill>
                  <AdminStatePill tone="accent">Pořadí #{Math.max(1, Math.round(props.category.sortOrder / 10))}</AdminStatePill>
                  <AdminStatePill tone="accent">{props.category.counts.total} služeb</AdminStatePill>
                </>
              )}
            </div>
          </div>

          {props.onClose ? (
            <button
              type="button"
              onClick={props.onClose}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/78 transition hover:bg-white/6 hover:text-white"
              aria-label="Zavřít detail"
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>
      </header>

      <form
        key={formKey}
        action={formAction}
        className="flex min-h-0 flex-1 flex-col"
      >
        <input type="hidden" name="area" value={props.area} />
        <input type="hidden" name="returnTo" value={props.returnTo} />
        {props.mode === "edit" ? <input type="hidden" name="categoryId" value={props.category.id} /> : null}
        {props.mode === "edit" ? (
          <input type="hidden" name="isActive" value={String(props.category.isActive)} />
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            {serverState.status === "success" && serverState.successMessage ? (
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-50">
                {serverState.successMessage}
              </div>
            ) : null}

            {serverState.status === "error" && serverState.formError ? (
              <div className="rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-50">
                {serverState.formError}
              </div>
            ) : null}

            <PanelSection title="Základ kategorie">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
            <Field label="Název kategorie" error={serverState.fieldErrors?.name}>
              <input
                    type="text"
                    name="name"
                    maxLength={120}
                    defaultValue={props.mode === "create" ? "" : props.category.name}
                    className={fieldClassName}
                  />
                </Field>

                <Field label="Pořadí" error={serverState.fieldErrors?.sortOrder}>
                  <input
                    type="number"
                    name="sortOrder"
                    min={0}
                    max={9999}
                    step={1}
                    inputMode="numeric"
                    defaultValue={props.mode === "create" ? 10 : props.category.sortOrder}
                    className={fieldClassName}
                  />
                </Field>
              </div>

              <Field
                label="Krátký popis (volitelné)"
                error={serverState.fieldErrors?.description}
                className="mt-4"
              >
                <textarea
                  name="description"
                  rows={3}
                  maxLength={160}
                  defaultValue={props.mode === "create" ? "" : props.category.description ?? ""}
                  onChange={(event) => setDescriptionLength(event.currentTarget.value.length)}
                  className={cn(fieldClassName, "min-h-[96px] resize-y leading-6")}
                  placeholder="Volitelné. Pomáhá jen tam, kde usnadní rychlou orientaci."
                />
                <div className="mt-2 text-right text-xs text-white/34">{descriptionLength}/160</div>
              </Field>
            </PanelSection>

            <PanelSection title="Veřejný ceník">
              <div className="grid gap-4">
                <Field label="Popis pro ceník" error={serverState.fieldErrors?.pricingDescription}>
                  <textarea
                    name="pricingDescription"
                    rows={3}
                    maxLength={240}
                    defaultValue={props.mode === "create" ? "" : props.category.pricingDescription ?? ""}
                    className={cn(fieldClassName, "min-h-[96px] resize-y leading-6")}
                    placeholder="Krátké vysvětlení, které se ukáže v hlavičce sekce na /cenik."
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Layout v ceníku" error={serverState.fieldErrors?.pricingLayout}>
                    <select
                      name="pricingLayout"
                      defaultValue={props.mode === "create" ? "GRID" : props.category.pricingLayout}
                      className={fieldClassName}
                    >
                      {pricingLayoutValues.map((value) => (
                        <option key={value} value={value} className="text-black">
                          {value === "LIST" ? "Velký seznam" : "Mřížka karet"}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Ikona" error={serverState.fieldErrors?.pricingIconKey}>
                    <select
                      name="pricingIconKey"
                      defaultValue={props.mode === "create" ? "SPARK" : props.category.pricingIconKey}
                      className={fieldClassName}
                    >
                      {pricingIconKeyValues.map((value) => (
                        <option key={value} value={value} className="text-black">
                          {formatPricingIconKeyLabel(value)}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Pořadí v ceníku" error={serverState.fieldErrors?.pricingSortOrder}>
                    <input
                      type="number"
                      name="pricingSortOrder"
                      min={0}
                      max={9999}
                      step={1}
                      inputMode="numeric"
                      defaultValue={props.mode === "create" ? 10 : props.category.pricingSortOrder}
                      className={fieldClassName}
                    />
                  </Field>
                </div>
              </div>
            </PanelSection>

            <PanelSection title="Viditelnost">
              {props.mode === "edit" ? (
                <button
                  type="button"
                  onClick={() => props.onToggleActive(!props.category.isActive)}
                  disabled={props.isActionPending}
                  className="flex w-full items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-left transition hover:border-white/14 hover:bg-white/[0.04] disabled:cursor-wait disabled:opacity-70"
                >
                  <ToggleVisual active={props.category.isActive} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">Aktivní kategorie</p>
                    <p className="mt-1 text-sm leading-6 text-white/52">
                      Vypnutí kategorii skryje, služby zůstanou zachované pro interní použití.
                    </p>
                  </div>
                </button>
              ) : (
                <label className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked
                    className="mt-1 h-5 w-5 rounded border-white/20 bg-black/40 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                  />
                  <div>
                    <p className="text-sm font-medium text-white">Aktivní kategorie</p>
                    <p className="mt-1 text-sm leading-6 text-white/52">
                      Nová kategorie bude po vytvoření hned viditelná v nabídce.
                    </p>
                  </div>
                </label>
              )}
            </PanelSection>

            {props.mode === "edit" ? (
              <PanelSection title="Navázané služby">
                <div className="grid gap-3 sm:grid-cols-3">
                  <SummaryCard label="Aktivní" value={props.category.counts.active} />
                  <SummaryCard label="Veřejné" value={props.category.counts.public} />
                  <SummaryCard label="Celkem" value={props.category.counts.total} />
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href={createServiceHref}
                    prefetch={false}
                    className="inline-flex min-h-11 items-center rounded-xl bg-[var(--color-accent)] px-4 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
                  >
                    + Vytvořit službu v této kategorii
                  </Link>
                  <Link
                    href={servicesHref}
                    prefetch={false}
                    className="inline-flex min-h-11 items-center rounded-xl border border-white/10 px-4 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/8"
                  >
                    Otevřít služby této kategorie
                  </Link>
                </div>

                <div className="mt-4 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.02]">
                  <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                    <p className="text-sm text-white/78">Rychlý přehled služeb</p>
                    <p className="text-xs text-white/34">Max {props.category.services.length} položek</p>
                  </div>

                  <div className="max-h-40 overflow-y-auto px-3 py-2">
                    <div className="grid gap-1.5">
                      {props.category.services.slice(0, 6).map((service) => (
                        <div
                          key={service.id}
                          className="grid grid-cols-[minmax(0,1fr)_78px_auto] items-center gap-3 rounded-xl border border-white/7 bg-black/14 px-3 py-2"
                        >
                          <p className="truncate text-sm font-medium text-white">{service.name}</p>
                          <p className="text-sm text-white/52">Pořadí {service.sortOrder}</p>
                          <div className="flex flex-wrap justify-end gap-2">
                            <AdminStatePill tone={service.isActive ? "active" : "muted"}>
                              {service.isActive ? "Aktivní" : "Skrytá"}
                            </AdminStatePill>
                            <AdminStatePill tone={service.isPubliclyBookable ? "active" : "muted"}>
                              {service.isPubliclyBookable ? "Veřejná" : "Interní"}
                            </AdminStatePill>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-white/8 px-3 py-2">
                    <Link
                      href={servicesHref}
                      prefetch={false}
                      className="flex items-center justify-center gap-2 rounded-xl bg-white/[0.03] px-4 py-3 text-sm font-medium text-[var(--color-accent-soft)] transition hover:bg-white/[0.05]"
                    >
                      <span className="text-base">+</span>
                      Zobrazit všechny služby ({props.category.counts.total})
                    </Link>
                  </div>
                </div>
              </PanelSection>
            ) : null}

            {props.mode === "edit" ? (
              <PanelSection title="Odstranění">
                <div className="rounded-2xl border border-amber-300/24 bg-[rgba(157,99,23,0.2)] px-4 py-3 text-sm leading-6 text-amber-50/90">
                  {props.category.counts.total > 0
                    ? `Kategorie obsahuje ${props.category.counts.total} služeb, takže mazání není dostupné. Pro běžný provoz je lepší ji jen vypnout.`
                    : "Kategorie je prázdná a může být bezpečně smazaná."}
                </div>
              </PanelSection>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-white/8 bg-[linear-gradient(180deg,rgba(7,10,18,0.12),rgba(7,10,18,0.94)_28%,rgba(7,10,18,0.98))] px-5 pb-5 pt-4 backdrop-blur-xl sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton label="Uložit" />
            <SubmitButton label="Uložit a zavřít" intent="save-close" secondary />
            {props.mode === "edit" ? (
              <button
                type="button"
                onClick={props.onDeactivate}
                disabled={!props.category.isActive || props.isActionPending}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-red-400/28 px-4 text-sm font-medium text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <TrashIcon />
                <span className="ml-2">Deaktivovat kategorii</span>
              </button>
            ) : props.onClose ? (
              <button
                type="button"
                onClick={props.onClose}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 px-4 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/8"
              >
                Zavřít
              </button>
            ) : null}
          </div>
        </div>
      </form>
    </section>
  );
}

const fieldClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/24 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/26 focus:border-[var(--color-accent)]/55 focus:bg-black/34";

function PanelSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-white/8 pt-5 first:border-t-0 first:pt-0">
      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/48">{title}</h4>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="text-sm text-white/80">{label}</span>
      {children}
      {error ? <p className="mt-2 text-sm text-red-200">{error}</p> : null}
    </label>
  );
}

function formatPricingIconKeyLabel(value: string) {
  switch (value) {
    case "DROPLET":
      return "Kapka / pleť";
    case "EYE_LASHES":
      return "Oko / řasy";
    case "LOTUS":
      return "Lotus";
    case "BRUSH":
      return "Štětec";
    case "LEAF":
      return "List";
    case "LIPSTICK":
      return "Rtěnka";
    default:
      return "Univerzální";
  }
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">{label}</p>
      <p className="mt-1 text-3xl font-medium text-white">{value}</p>
    </div>
  );
}

function ToggleVisual({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full border px-1 transition",
        active ? "border-emerald-300/24 bg-emerald-400/18" : "border-white/10 bg-black/35",
      )}
    >
      <span
        className={cn(
          "h-4.5 w-4.5 rounded-full transition",
          active ? "translate-x-[18px] bg-emerald-100" : "translate-x-0 bg-white/72",
        )}
      />
    </span>
  );
}

function SubmitButton({
  label,
  intent = "save",
  secondary = false,
}: {
  label: string;
  intent?: "save" | "save-close";
  secondary?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      disabled={pending}
      className={cn(
        "inline-flex min-h-12 items-center justify-center rounded-xl px-6 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-70",
        secondary
          ? "border border-white/10 bg-white/[0.02] text-white/82 hover:border-white/18 hover:bg-white/8"
          : "bg-[var(--color-accent)] text-[var(--color-accent-contrast)] hover:brightness-105",
      )}
    >
      {pending ? "Ukládám..." : label}
    </button>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M5 5l8 8M13 5l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 2.5h4M2.5 4h11M5 4V3.5A1.5 1.5 0 0 1 6.5 2h3A1.5 1.5 0 0 1 11 3.5V4m-5 2.5V11m3-4.5V11M4 4l.5 8A1.5 1.5 0 0 0 6 13.5h4A1.5 1.5 0 0 0 11.5 12L12 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
