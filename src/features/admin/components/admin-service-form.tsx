"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { type AdminArea } from "@/config/navigation";
import {
  createServiceAction,
  updateServiceAction,
} from "@/features/admin/actions/service-actions";
import {
  initialUpdateServiceActionState,
} from "@/features/admin/actions/update-service-action-state";
import { AdminStatePill } from "@/features/admin/components/admin-state-pill";
import { pricingBadgeSuggestions } from "@/features/admin/lib/admin-service-validation";
import { formatServicePrice } from "@/features/admin/lib/admin-service-format";

type CategoryOption = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
};

type BaseServiceFormProps = {
  area: AdminArea;
  categories: CategoryOption[];
  returnTo: string;
};

type EditServiceFormProps = BaseServiceFormProps & {
  mode: "edit";
  service: {
    id: string;
    name: string;
    description: string | null;
    publicIntro: string | null;
    seoDescription: string | null;
    pricingShortDescription: string | null;
    pricingBadge: string | null;
    durationMinutes: number;
    priceFromCzk: number | null;
    sortOrder: number;
    isActive: boolean;
    isPubliclyBookable: boolean;
    categoryId: string;
    category: {
      name: string;
      isActive: boolean;
    };
    _count: {
      bookings: number;
      allowedAvailabilitySlots: number;
    };
    warnings: string[];
  };
};

type CreateServiceFormProps = BaseServiceFormProps & {
  mode: "create";
  initialValues: {
    name: string;
    description: string;
    publicIntro: string;
    seoDescription: string;
    pricingShortDescription: string;
    pricingBadge: string;
    durationMinutes: number;
    priceFromCzk: string;
    categoryId?: string;
    isActive: boolean;
    isPubliclyBookable: boolean;
  };
};

export function AdminServiceForm(props: EditServiceFormProps | CreateServiceFormProps) {
  const [serverState, formAction] = useActionState(
    props.mode === "create" ? createServiceAction : updateServiceAction,
    initialUpdateServiceActionState,
  );

  const selectedCategory =
    props.categories.find((category) =>
      category.id === (props.mode === "create" ? props.initialValues.categoryId : props.service.categoryId),
    ) ?? props.categories[0];

  const summaryWarnings =
    props.mode === "edit"
      ? props.service.warnings
      : [
          ...(selectedCategory && !selectedCategory.isActive ? ["Nová služba bude v neaktivní kategorii, takže zůstane veřejně skrytá."] : []),
        ];

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="area" value={props.area} />
      <input type="hidden" name="returnTo" value={props.returnTo} />
      {props.mode === "edit" ? <input type="hidden" name="serviceId" value={props.service.id} /> : null}

      {serverState.status === "success" && serverState.successMessage ? (
        <div className="rounded-[1.25rem] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-50">
          {serverState.successMessage}
        </div>
      ) : null}

      {serverState.status === "error" && serverState.formError ? (
        <div className="rounded-[1.25rem] border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-50">
          {serverState.formError}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 rounded-[1.25rem] border border-white/8 bg-white/5 p-4">
        {props.mode === "edit" ? (
          <>
            <AdminStatePill tone={props.service.isActive ? "active" : "muted"}>
              {props.service.isActive ? "Aktivní" : "Neaktivní"}
            </AdminStatePill>
            <AdminStatePill tone={props.service.isPubliclyBookable ? "active" : "muted"}>
              {props.service.isPubliclyBookable ? "Veřejná rezervace" : "Jen interní"}
            </AdminStatePill>
            <AdminStatePill tone="accent">{formatServicePrice(props.service.priceFromCzk)}</AdminStatePill>
            <AdminStatePill tone="accent">{props.service.durationMinutes} min</AdminStatePill>
          </>
        ) : (
          <>
            <AdminStatePill tone="accent">Nová služba</AdminStatePill>
            <AdminStatePill tone="muted">Vytvoří se rovnou do katalogu</AdminStatePill>
          </>
        )}
      </div>

      {summaryWarnings.length > 0 ? (
        <section className="rounded-[1.25rem] border border-amber-300/20 bg-amber-400/10 p-4">
          <h4 className="font-display text-xl text-white">Provozní upozornění</h4>
          <div className="mt-3 grid gap-2">
            {summaryWarnings.map((warning) => (
              <p key={warning} className="text-sm leading-6 text-amber-50">{warning}</p>
            ))}
          </div>
        </section>
      ) : null}

      <SectionBlock
        title="Základ služby"
        description="Nejdůležitější údaje pro rychlou práci v ceníku i v rezervačním flow."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Název služby" error={serverState.fieldErrors?.name}>
              <input
                type="text"
                name="name"
                defaultValue={props.mode === "create" ? props.initialValues.name : props.service.name}
                maxLength={120}
                className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
              />
            </Field>
          </div>

          <Field label="Délka v minutách" error={serverState.fieldErrors?.durationMinutes}>
            <input
              type="number"
              name="durationMinutes"
              min={5}
              max={480}
              step={5}
              inputMode="numeric"
              defaultValue={props.mode === "create" ? props.initialValues.durationMinutes : props.service.durationMinutes}
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
            />
          </Field>

          <Field label="Cena (Kč)" error={serverState.fieldErrors?.priceFromCzk}>
            <input
              type="number"
              name="priceFromCzk"
              min={0}
              max={50000}
              step={50}
              inputMode="numeric"
              defaultValue={props.mode === "create" ? props.initialValues.priceFromCzk : props.service.priceFromCzk ?? ""}
              placeholder="Např. 1200"
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
            />
          </Field>

          {props.mode === "edit" ? (
            <>
              <div className="space-y-4">
                <Field label="Pořadí" error={serverState.fieldErrors?.sortOrder}>
                  <input
                    type="number"
                    name="sortOrder"
                    min={0}
                    max={9999}
                    step={1}
                    inputMode="numeric"
                    defaultValue={props.service.sortOrder}
                    className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
                  />
                </Field>

                <Field label="Kategorie" error={serverState.fieldErrors?.categoryId}>
                  <select
                    name="categoryId"
                    defaultValue={props.service.categoryId}
                    className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
                  >
                    {props.categories.map((category) => (
                      <option key={category.id} value={category.id} className="text-black">
                        {category.name}{category.isActive ? "" : " (neaktivní)"}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="rounded-[1.1rem] border border-white/8 bg-white/5 p-4 text-sm text-white/72">
                <p className="font-medium text-white">Provozní kontext</p>
                <div className="mt-2 space-y-2 leading-6">
                  <p>Rezervace: {props.service._count.bookings}</p>
                  <p>Napojení na sloty: {props.service._count.allowedAvailabilitySlots}</p>
                  <p>Kategorie: {props.service.category.name}</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <Field label="Kategorie" error={serverState.fieldErrors?.categoryId}>
                <select
                  name="categoryId"
                  defaultValue={props.initialValues.categoryId}
                  className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
                >
                  {props.categories.map((category) => (
                    <option key={category.id} value={category.id} className="text-black">
                      {category.name}{category.isActive ? "" : " (neaktivní)"}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="rounded-[1.1rem] border border-white/8 bg-white/5 p-4 text-sm text-white/72">
                <p className="font-medium text-white">Provozní kontext</p>
                <p className="mt-2 leading-6">
                  Nová služba se po vytvoření otevře v detailu, takže ji můžete hned doladit nebo zavřít zpět do seznamu.
                </p>
              </div>
            </>
          )}
        </div>
      </SectionBlock>

      <SectionBlock
        title="Publikace"
        description="Aktivita a veřejná rezervovatelnost zůstávají oddělené, aby šlo držet interní služby bez chaosu."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleCard
            name="isActive"
            defaultChecked={props.mode === "create" ? props.initialValues.isActive : props.service.isActive}
            title="Aktivní služba"
            description="Použijte, když má služba zůstat v běžné nabídce a provoz s ní dál počítá."
          />
          <ToggleCard
            name="isPubliclyBookable"
            defaultChecked={
              props.mode === "create" ? props.initialValues.isPubliclyBookable : props.service.isPubliclyBookable
            }
            title="Veřejně rezervovatelná"
            description="Použijte, když se má služba objevit klientkám na webu a v rezervačním flow."
          />
        </div>
      </SectionBlock>

      <SectionBlock
        title="Web a rezervace"
        description="Vše, co klientka uvidí pod stejným názvem na webu i v rezervačním kroku výběru služby."
      >
        <div className="grid gap-4">
          <Field label="Krátký popis (web + rezervace)" error={serverState.fieldErrors?.publicIntro}>
            <textarea
              name="publicIntro"
              rows={3}
              maxLength={400}
              defaultValue={props.mode === "create" ? props.initialValues.publicIntro : props.service.publicIntro ?? ""}
              placeholder="Hlavní krátký text služby. Ukáže se v seznamu služeb i při výběru služby v rezervaci."
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
            />
          </Field>

          <Field label="Detail služby (detail na webu)" error={serverState.fieldErrors?.description}>
            <textarea
              name="description"
              rows={4}
              maxLength={4000}
              defaultValue={props.mode === "create" ? props.initialValues.description : props.service.description ?? ""}
              placeholder="Delší text pro stránku detailu služby na webu."
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
            />
          </Field>
        </div>
      </SectionBlock>

      <SectionBlock
        title="Ceník"
        description="Texty, které se zobrazují na stránce ceníku."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Krátký popis do ceníku" error={serverState.fieldErrors?.pricingShortDescription}>
            <textarea
              name="pricingShortDescription"
              rows={3}
              maxLength={240}
              defaultValue={
                props.mode === "create"
                  ? props.initialValues.pricingShortDescription
                  : props.service.pricingShortDescription ?? ""
              }
              placeholder="Jedna věta pro řádek nebo kartu v ceníku."
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
            />
          </Field>

          <Field label="Štítek do ceníku" error={serverState.fieldErrors?.pricingBadge}>
            <input
              type="text"
              name="pricingBadge"
              list="pricing-badge-suggestions"
              maxLength={40}
              defaultValue={props.mode === "create" ? props.initialValues.pricingBadge : props.service.pricingBadge ?? ""}
              placeholder="Např. PRO PRVNÍ NÁVŠTĚVU"
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
            />
            <datalist id="pricing-badge-suggestions">
              {pricingBadgeSuggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </Field>
        </div>
      </SectionBlock>

      <SectionBlock
        title="Google (SEO)"
        description="Volitelný popis pro výsledek ve vyhledávání Google na detailu služby."
      >
        <Field label="Popis pro Google (SEO meta)" error={serverState.fieldErrors?.seoDescription}>
          <textarea
            name="seoDescription"
            rows={3}
            maxLength={240}
            defaultValue={props.mode === "create" ? props.initialValues.seoDescription : props.service.seoDescription ?? ""}
            placeholder="Krátký popis, který se může zobrazit pod názvem stránky ve vyhledávání."
            className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
          />
        </Field>
      </SectionBlock>

      <SubmitButtons isCreate={props.mode === "create"} />
    </form>
  );
}

function SectionBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4">
      <div className="border-b border-white/10 pb-4">
        <h4 className="font-display text-xl text-white">{title}</h4>
        <p className="mt-2 text-sm leading-6 text-white/62">{description}</p>
      </div>
      <div className="pt-4">{children}</div>
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
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
    </label>
  );
}

function ToggleCard({
  name,
  defaultChecked,
  title,
  description,
}: {
  name: string;
  defaultChecked: boolean;
  title: string;
  description: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-[1.1rem] border border-white/8 bg-white/5 p-4">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 rounded border-white/20 bg-black/20 text-[var(--color-accent)]"
      />
      <span>
        <span className="block text-sm font-medium text-white">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-white/66">{description}</span>
      </span>
    </label>
  );
}

function SubmitButtons({ isCreate }: { isCreate: boolean }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="submit"
        name="intent"
        value="save"
        disabled={pending}
        className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? (isCreate ? "Vytvářím službu..." : "Ukládám službu...") : isCreate ? "Vytvořit službu" : "Uložit"}
      </button>

      {!isCreate ? (
        <button
          type="submit"
          name="intent"
          value="save-close"
          disabled={pending}
          className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-white/18 hover:bg-white/6 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Uložit a zavřít
        </button>
      ) : null}
    </div>
  );
}
