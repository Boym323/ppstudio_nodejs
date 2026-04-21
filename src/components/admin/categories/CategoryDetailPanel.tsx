"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import {
  createServiceCategoryAction,
  deleteServiceCategoryAction,
  updateServiceCategoryAction,
} from "@/features/admin/actions/service-category-actions";
import {
  initialUpdateServiceCategoryActionState,
} from "@/features/admin/actions/update-service-category-action-state";
import { AdminStatePill } from "@/features/admin/components/admin-state-pill";
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
    sortOrder: number;
    isActive: boolean;
  }) => void;
  onDeactivate?: () => void;
};

type Props =
  | (BaseProps & {
      mode: "create";
    })
  | (BaseProps & {
      mode: "edit";
      category: CategoryRecord;
    });

export function CategoryDetailPanel(props: Props) {
  const { onSaved } = props;
  const [serverState, formAction] = useActionState(
    props.mode === "create" ? createServiceCategoryAction : updateServiceCategoryAction,
    initialUpdateServiceCategoryActionState,
  );
  const lastReportedId = useRef<string | null>(null);

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

  const showDeleteSection = props.mode === "edit" && props.category.counts.total === 0;

  return (
    <section className="flex h-full max-h-[calc(100dvh-2rem)] min-h-[40rem] flex-col overflow-hidden rounded-[1.9rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(7,10,18,0.98))] shadow-[0_34px_120px_rgba(0,0,0,0.34)] xl:max-h-[calc(100vh-3rem)]">
      <header className="shrink-0 border-b border-white/8 px-5 pb-4 pt-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.24em] text-white/38">
              {props.mode === "create" ? "Nová kategorie" : "Detail kategorie"}
            </p>
            <h3 className="mt-2 truncate text-[1.65rem] font-medium leading-tight text-white">
              {props.mode === "create" ? "Kategorie služeb" : props.category.name}
            </h3>
          </div>
          {props.onClose ? (
            <button
              type="button"
              onClick={props.onClose}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-white/76 transition hover:border-white/18 hover:bg-white/8"
              aria-label="Zavřít detail"
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {props.mode === "create" ? (
            <>
              <AdminStatePill tone="accent">Připraveno</AdminStatePill>
              <AdminStatePill tone="muted">Bez služeb</AdminStatePill>
            </>
          ) : (
            <>
              <AdminStatePill tone={props.category.isActive ? "active" : "muted"}>
                {props.category.isActive ? "Aktivní" : "Skrytá"}
              </AdminStatePill>
              <AdminStatePill tone="accent">
                Pořadí #{Math.max(1, Math.round(props.category.sortOrder / 10))}
              </AdminStatePill>
              <AdminStatePill tone={props.category.counts.total > 0 ? "accent" : "muted"}>
                {props.category.counts.total} služeb
              </AdminStatePill>
            </>
          )}
        </div>
      </header>

      <form
        key={props.mode === "create" ? "create" : props.category.id}
        action={formAction}
        className="flex min-h-0 flex-1 flex-col"
      >
        <input type="hidden" name="area" value={props.area} />
        <input type="hidden" name="returnTo" value={props.returnTo} />
        {props.mode === "edit" ? <input type="hidden" name="categoryId" value={props.category.id} /> : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
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

            <PanelSection
              title="Základ kategorie"
              helper="Název, pořadí a krátký kontext pro rychlou orientaci v katalogu."
            >
              <div className="space-y-4">
                <Field label="Název" error={serverState.fieldErrors?.name}>
                  <input
                    type="text"
                    name="name"
                    maxLength={120}
                    defaultValue={props.mode === "create" ? "" : props.category.name}
                    className={fieldClassName}
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-[148px_minmax(0,1fr)]">
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

                  <Field label="Krátký popis" error={serverState.fieldErrors?.description}>
                    <textarea
                      name="description"
                      rows={3}
                      maxLength={1000}
                      defaultValue={props.mode === "create" ? "" : props.category.description ?? ""}
                      className={cn(fieldClassName, "min-h-[96px] resize-y leading-6")}
                      placeholder="Volitelné. Stačí krátký popis, který pomůže v adminu."
                    />
                  </Field>
                </div>
              </div>
            </PanelSection>

            <PanelSection
              title="Viditelnost"
              helper="Vypnutí kategorii schová, ale služby zůstanou."
            >
              <label className="flex items-start justify-between gap-4 rounded-2xl border border-white/8 bg-black/16 px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium text-white">Aktivní kategorie</p>
                  <p className="mt-1 text-sm leading-6 text-white/50">
                    Použijte, když má zůstat v běžné nabídce a booking flow.
                  </p>
                </div>
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={props.mode === "create" ? true : props.category.isActive}
                  className="mt-1 h-5 w-5 rounded border-white/20 bg-black/40 text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                />
              </label>
            </PanelSection>

            {props.mode === "edit" ? (
              <PanelSection
                title="Navázané služby"
                helper="Souhrn a rychlé akce bez zbytečného prodlužování panelu."
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <SummaryCard label="Aktivní" value={props.category.counts.active} />
                  <SummaryCard label="Veřejné" value={props.category.counts.public} />
                  <SummaryCard label="Celkem" value={props.category.counts.total} />
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={`${props.servicesPath}?mode=create&category=${props.category.id}`}
                    className="inline-flex rounded-xl bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
                  >
                    Vytvořit službu v této kategorii
                  </a>
                  <a
                    href={`${props.servicesPath}?category=${props.category.id}`}
                    className="inline-flex rounded-xl border border-white/10 px-4 py-3 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/8"
                  >
                    Otevřít služby této kategorie
                  </a>
                </div>

                {props.category.services.length > 0 ? (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-white/8 bg-black/18">
                    <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                      <p className="text-sm font-medium text-white">Rychlý přehled služeb</p>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                        max 6 položek
                      </p>
                    </div>

                    <div className="max-h-56 overflow-y-auto px-3 py-3">
                      <div className="grid gap-2">
                        {props.category.services.map((service) => (
                          <div
                            key={service.id}
                            className="flex items-start justify-between gap-3 rounded-xl border border-white/7 bg-white/[0.03] px-3 py-2.5"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">{service.name}</p>
                              <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/40">
                                Pořadí {service.sortOrder}
                              </p>
                            </div>
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
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-white/12 bg-black/12 px-4 py-4 text-sm leading-6 text-white/54">
                    Tato kategorie zatím nemá žádnou službu.
                  </div>
                )}
              </PanelSection>
            ) : null}

            {showDeleteSection ? (
              <PanelSection
                title="Odstranění"
                helper="Prázdnou kategorii lze smazat, jinak je bezpečnější ji jen vypnout."
              >
                <>
                  <input type="hidden" name="area" value={props.area} />
                  <input type="hidden" name="categoryId" value={props.category.id} />
                  <input type="hidden" name="currentPath" value={props.returnTo} />
                  <div className="rounded-2xl border border-amber-300/18 bg-amber-400/8 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="max-w-[20rem] text-sm leading-6 text-amber-50/90">
                        Kategorie je prázdná a může být odstraněná bez dopadu na služby.
                      </p>
                      <button
                        type="submit"
                        formAction={deleteServiceCategoryAction}
                        className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/76 transition hover:border-white/18 hover:bg-white/8"
                      >
                        Smazat prázdnou kategorii
                      </button>
                    </div>
                  </div>
                </>
              </PanelSection>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-white/8 bg-[linear-gradient(180deg,rgba(7,10,18,0.18),rgba(7,10,18,0.94)_28%,rgba(7,10,18,0.98))] px-5 pb-5 pt-4 backdrop-blur-xl sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton label="Uložit" />
            <SubmitButton label={props.onClose ? "Uložit a zavřít" : "Uložit a zavřít"} intent="save-close" secondary />
            {props.mode === "edit" ? (
              <button
                type="button"
                onClick={props.onDeactivate}
                disabled={!props.category.isActive}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-red-300/24 px-4 text-sm font-medium text-red-100 transition hover:border-red-300/34 hover:bg-red-400/12 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Deaktivovat kategorii
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
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-white/8 pt-6 first:border-t-0 first:pt-0">
      <div className="mb-4">
        <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/58">{title}</h4>
        {helper ? <p className="mt-1 text-sm leading-6 text-white/42">{helper}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-white">{label}</span>
      {children}
      {error ? <p className="mt-2 text-sm text-red-200">{error}</p> : null}
    </label>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/18 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">{label}</p>
      <p className="mt-2 text-lg font-medium text-white">{value}</p>
    </div>
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
        "inline-flex min-h-12 items-center justify-center rounded-xl px-4 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-70",
        secondary
          ? "border border-white/10 text-white/80 hover:border-white/18 hover:bg-white/8"
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
