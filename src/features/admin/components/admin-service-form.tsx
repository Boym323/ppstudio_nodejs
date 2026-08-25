"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
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
import { MAX_SERVICE_CLEANUP_MINUTES } from "@/features/booking/lib/booking-cleanup";
import { pricingBadgeSuggestions } from "@/features/admin/lib/admin-service-validation";
import { formatServicePrice } from "@/features/admin/lib/admin-service-format";
import {
  isFormDirty,
  resolveSavedFormSnapshot,
  serializeFormEntries,
} from "@/features/admin/lib/admin-form-dirty-state";

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
    publicName: string | null;
    description: string | null;
    publicIntro: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    idealFor: string[];
    includes: string[];
    benefits: string[];
    goodToKnow: string[];
    pricingShortDescription: string | null;
    pricingBadge: string | null;
    durationMinutes: number;
    cleanupMinutes: number;
    priceFromCzk: number | null;
    sortOrder: number;
    isFeaturedOnHomepage: boolean;
    homepageSortOrder: number;
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
    priceChangeLogs: Array<{
      id: string;
      oldPriceFromCzk: number | null;
      newPriceFromCzk: number | null;
      createdAtLabel: string;
      changedByUser: {
        name: string;
        email: string;
      } | null;
    }>;
  };
};

type CreateServiceFormProps = BaseServiceFormProps & {
  mode: "create";
  initialValues: {
    name: string;
    publicName: string;
    description: string;
    publicIntro: string;
    seoTitle: string;
    seoDescription: string;
    idealFor: string[];
    includes: string[];
    benefits: string[];
    goodToKnow: string[];
    pricingShortDescription: string;
    pricingBadge: string;
    durationMinutes: number;
    cleanupMinutes: number;
    priceFromCzk: string;
    isFeaturedOnHomepage: boolean;
    homepageSortOrder: number;
    categoryId?: string;
    isActive: boolean;
    isPubliclyBookable: boolean;
  };
};

function listToTextareaValue(items: string[] | null | undefined) {
  return items?.join("\n") ?? "";
}

export function AdminServiceForm(props: EditServiceFormProps | CreateServiceFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const initialSnapshotRef = useRef<string>();
  const [isDirty, setIsDirty] = useState(false);
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

  function getCurrentSnapshot(form: HTMLFormElement) {
    return serializeFormEntries(new FormData(form).entries());
  }

  function updateDirtyState(event: FormEvent<HTMLFormElement>) {
    const currentSnapshot = getCurrentSnapshot(event.currentTarget);
    initialSnapshotRef.current ??= currentSnapshot;
    setIsDirty(isFormDirty(initialSnapshotRef.current, currentSnapshot));
  }

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const currentSnapshot = getCurrentSnapshot(form);
    if (initialSnapshotRef.current === undefined) {
      initialSnapshotRef.current = currentSnapshot;
      return;
    }

    initialSnapshotRef.current = resolveSavedFormSnapshot(
      initialSnapshotRef.current,
      currentSnapshot,
      serverState.status,
    );
    if (serverState.status === "success") {
      setIsDirty(false);
    }
  }, [serverState]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-5"
      data-unsaved-changes={isDirty ? "true" : "false"}
      onInput={updateDirtyState}
      onChange={updateDirtyState}
    >
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
            {props.service.isFeaturedOnHomepage ? <AdminStatePill tone="accent">Homepage #{props.service.homepageSortOrder}</AdminStatePill> : null}
            <AdminStatePill tone="accent">{formatServicePrice(props.service.priceFromCzk)}</AdminStatePill>
            <AdminStatePill tone="accent">{props.service.durationMinutes} min</AdminStatePill>
            {props.service.cleanupMinutes > 0 ? (
              <AdminStatePill tone="muted">Úklid {props.service.cleanupMinutes} min</AdminStatePill>
            ) : null}
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

          <div className="sm:col-span-2">
            <Field label="Veřejný název" error={serverState.fieldErrors?.publicName}>
              <input
                type="text"
                name="publicName"
                maxLength={120}
                defaultValue={props.mode === "create" ? props.initialValues.publicName : props.service.publicName ?? ""}
                placeholder="Volitelné. Pokud zůstane prázdný, použije se název služby."
                className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
              />
            </Field>
          </div>

          <Field
            label="Kategorie"
            error={serverState.fieldErrors?.categoryId}
            help="Určuje, ve které skupině se služba zobrazí v nabídce a ceníku."
          >
            <select
              name="categoryId"
              defaultValue={props.mode === "create" ? props.initialValues.categoryId : props.service.categoryId}
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
            >
              {props.categories.map((category) => (
                <option key={category.id} value={category.id} className="text-black">
                  {category.name}{category.isActive ? "" : " (neaktivní)"}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Cena od (Kč)"
            error={serverState.fieldErrors?.priceFromCzk}
            help="Nejnižší cena, která se zobrazí u služby na webu a v ceníku. Prázdné pole cenu nezobrazí."
          >
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

          <Field
            label="Délka služby (min)"
            error={serverState.fieldErrors?.durationMinutes}
            help="Délka termínu, který klientka uvidí a zarezervuje."
          >
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

          <Field
            label="Čas na úklid po službě"
            error={serverState.fieldErrors?.cleanupMinutes}
            help="Použije se pouze pro interní blokaci termínu po službě. Klientce se nezobrazuje jako délka služby."
          >
            <input
              type="number"
              name="cleanupMinutes"
              min={0}
              max={MAX_SERVICE_CLEANUP_MINUTES}
              step={5}
              inputMode="numeric"
              defaultValue={props.mode === "create" ? props.initialValues.cleanupMinutes : props.service.cleanupMinutes}
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
            />
          </Field>

          {props.mode === "edit" ? (
            <>
              <Field
                label="Pořadí v kategorii"
                error={serverState.fieldErrors?.sortOrder}
                help="Nižší číslo zobrazí službu v dané kategorii dříve."
              >
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
        title="Web a rezervace"
        description="Vše, co klientka uvidí pod stejným názvem na webu i v rezervačním kroku výběru služby."
      >
        <div className="grid gap-4">
          <Field
            label="Krátký popis (web + rezervace)"
            error={serverState.fieldErrors?.publicIntro}
            help="Zobrazí se v nabídce i při výběru termínu. Pro online rezervovatelnou službu je povinný."
          >
            <textarea
              name="publicIntro"
              rows={3}
              maxLength={400}
              defaultValue={props.mode === "create" ? props.initialValues.publicIntro : props.service.publicIntro ?? ""}
              placeholder="Hlavní krátký text služby. Ukáže se v seznamu služeb i při výběru služby v rezervaci."
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
            />
          </Field>

          <Field
            label="Podrobný popis služby"
            error={serverState.fieldErrors?.description}
            help="Delší text pro samostatnou stránku služby na webu."
          >
            <textarea
              name="description"
              rows={4}
              maxLength={4000}
              defaultValue={props.mode === "create" ? props.initialValues.description : props.service.description ?? ""}
              placeholder="Popište průběh služby, její zaměření nebo co klientka může očekávat."
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
            />
          </Field>
        </div>
      </SectionBlock>

      <SectionBlock
        title="Strukturovaný detail"
        description="Každý neprázdný řádek se na detailu služby zobrazí jako samostatný bod."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pro koho je služba vhodná" error={serverState.fieldErrors?.idealFor}>
            <textarea
              name="idealFor"
              rows={5}
              maxLength={240 * 8}
              defaultValue={
                props.mode === "create"
                  ? listToTextareaValue(props.initialValues.idealFor)
                  : listToTextareaValue(props.service.idealFor)
              }
              placeholder="Jeden bod na řádek."
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
            />
          </Field>

          <Field label="Co služba obsahuje" error={serverState.fieldErrors?.includes}>
            <textarea
              name="includes"
              rows={5}
              maxLength={240 * 8}
              defaultValue={
                props.mode === "create"
                  ? listToTextareaValue(props.initialValues.includes)
                  : listToTextareaValue(props.service.includes)
              }
              placeholder="Jeden bod na řádek."
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
            />
          </Field>

          <Field label="Očekávaný přínos" error={serverState.fieldErrors?.benefits}>
            <textarea
              name="benefits"
              rows={5}
              maxLength={240 * 8}
              defaultValue={
                props.mode === "create"
                  ? listToTextareaValue(props.initialValues.benefits)
                  : listToTextareaValue(props.service.benefits)
              }
              placeholder="Jeden bod na řádek."
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
            />
          </Field>

          <Field label="Dobré vědět" error={serverState.fieldErrors?.goodToKnow}>
            <textarea
              name="goodToKnow"
              rows={5}
              maxLength={240 * 8}
              defaultValue={
                props.mode === "create"
                  ? listToTextareaValue(props.initialValues.goodToKnow)
                  : listToTextareaValue(props.service.goodToKnow)
              }
              placeholder="Jeden bod na řádek."
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
            />
          </Field>
        </div>
      </SectionBlock>

      <SectionBlock
        title="Zveřejnění a rezervace"
        description="Nastavte, zda služba patří do běžné nabídky a zda si ji klientky mohou samy rezervovat."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleCard
            name="isActive"
            defaultChecked={props.mode === "create" ? props.initialValues.isActive : props.service.isActive}
            title="Aktivní služba"
            description="Služba zůstane součástí běžné nabídky a provoz s ní bude dál počítat."
          />
          <ToggleCard
            name="isPubliclyBookable"
            defaultChecked={
              props.mode === "create" ? props.initialValues.isPubliclyBookable : props.service.isPubliclyBookable
            }
            title="Lze rezervovat online"
            description="Klientky ji uvidí na webu a budou si ji moci vybrat při online rezervaci."
          />
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
        title="Doporučená služba na úvodní stránce"
        description="Vyberte službu, kterou chcete nabídnout v sekci Doporučené služby. Zobrazí se nejvýše první tři podle pořadí."
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1.25fr)_180px] sm:items-start">
          <ToggleCard
            name="isFeaturedOnHomepage"
            defaultChecked={
              props.mode === "create" ? props.initialValues.isFeaturedOnHomepage : props.service.isFeaturedOnHomepage
            }
            title="Zobrazit na úvodní stránce"
            description="Vhodné pro služby, které chcete novým klientkám aktivně doporučit."
          />
          <Field
            label="Pořadí na úvodní stránce"
            error={serverState.fieldErrors?.homepageSortOrder}
            help="Nižší číslo zobrazí službu dříve."
          >
            <input
              type="number"
              name="homepageSortOrder"
              min={0}
              max={9999}
              step={1}
              inputMode="numeric"
              defaultValue={props.mode === "create" ? props.initialValues.homepageSortOrder : props.service.homepageSortOrder}
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
            />
          </Field>
        </div>
      </SectionBlock>

      {props.mode === "edit" ? (
        <SectionBlock
          title="Historie ceny"
          description="Poslední auditní změny ceny služby včetně času a aktéra."
        >
          {props.service.priceChangeLogs.length > 0 ? (
            <div className="grid gap-3">
              {props.service.priceChangeLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-[1.1rem] border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/72"
                >
                  <p className="font-medium text-white">
                    {formatServicePrice(log.oldPriceFromCzk)} -&gt; {formatServicePrice(log.newPriceFromCzk)}
                  </p>
                  <p className="mt-1 leading-6">
                    {log.createdAtLabel} •{" "}
                    {log.changedByUser?.name || log.changedByUser?.email || "Systém / neznámý uživatel"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-white/62">
              Zatím bez zaznamenané změny ceny. Audit vzniká až při skutečné úpravě pole cena.
            </p>
          )}
        </SectionBlock>
      ) : null}

      <SectionBlock
        title="Google (SEO)"
        description="Volitelný název a popis pro výsledek ve vyhledávání Google. Pokud je necháte prázdné, použije se běžný název a popis služby."
      >
        <div className="grid gap-4">
          <Field label="SEO title" error={serverState.fieldErrors?.seoTitle}>
            <input
              type="text"
              name="seoTitle"
              maxLength={120}
              defaultValue={props.mode === "create" ? props.initialValues.seoTitle : props.service.seoTitle ?? ""}
              placeholder="Např. Lash lifting Zlín"
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
            />
          </Field>

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
        </div>
      </SectionBlock>

      <SubmitButtons isCreate={props.mode === "create"} isDirty={isDirty} />
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
  help,
}: {
  label: string;
  error?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-white">{label}</span>
      {children}
      {help ? <p className="mt-2 text-xs leading-5 text-white/52">{help}</p> : null}
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

function SubmitButtons({ isCreate, isDirty }: { isCreate: boolean; isDirty: boolean }) {
  const { pending } = useFormStatus();

  return (
    <div className="sticky bottom-0 z-10 -mx-5 flex flex-wrap items-center gap-3 border-t border-white/10 bg-[#131116]/96 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6">
      <p
        aria-live="polite"
        className={`mr-auto text-sm font-medium ${isDirty ? "text-amber-200" : "text-emerald-200"}`}
      >
        {isDirty ? "Neuložené změny" : "Vše uloženo"}
      </p>
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
