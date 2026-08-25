"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
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
  applyServicePresentationStatus,
  getServicePresentationStatus,
  servicePresentationStatusLabels,
  type ServicePresentationStatus,
} from "@/features/admin/lib/service-presentation-status";
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
    slug: string;
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
      changeLogs: number;
      priceChangeLogs: number;
    };
    warnings: string[];
    priceChangeLogs: Array<{
      id: string;
      oldPriceFromCzk: number | null;
      newPriceFromCzk: number | null;
      createdAt: string;
      createdAtLabel: string;
      changedByUser: {
        name: string;
        email: string;
      } | null;
    }>;
    changeLogs: Array<{
      id: string;
      summary: string;
      createdAt: string;
      createdAtLabel: string;
      actorUser: {
        name: string;
        email: string;
      };
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
  const initialSnapshotRef = useRef<string | undefined>(undefined);
  const [isDirty, setIsDirty] = useState(false);
  const initialOperationalValues = {
    isActive: props.mode === "create" ? props.initialValues.isActive : props.service.isActive,
    isPubliclyBookable: props.mode === "create" ? props.initialValues.isPubliclyBookable : props.service.isPubliclyBookable,
  };
  const [isActive, setIsActive] = useState(initialOperationalValues.isActive);
  const [isPubliclyBookable, setIsPubliclyBookable] = useState(initialOperationalValues.isPubliclyBookable);
  const [categoryId, setCategoryId] = useState(
    props.mode === "create" ? props.initialValues.categoryId : props.service.categoryId,
  );
  const [durationMinutes, setDurationMinutes] = useState(
    props.mode === "create" ? props.initialValues.durationMinutes : props.service.durationMinutes,
  );
  const [, startTransition] = useTransition();
  const [serverState, formAction] = useActionState(
    props.mode === "create" ? createServiceAction : updateServiceAction,
    initialUpdateServiceActionState,
  );

  const selectedCategory =
    props.categories.find((category) =>
      category.id === categoryId,
    ) ?? props.categories[0];
  const presentationStatus = getServicePresentationStatus({ isActive, isPubliclyBookable });
  const durationChanged = props.mode === "edit" && durationMinutes !== props.service.durationMinutes;
  const isBeingDeactivated = props.mode === "edit" && props.service.isActive && !isActive;
  const isPublicService =
    props.mode === "edit" &&
    props.service.isActive &&
    props.service.isPubliclyBookable &&
    props.service.category.isActive &&
    Boolean(
      props.service.publicIntro ||
      props.service.description ||
      props.service.seoDescription ||
      props.service.pricingShortDescription,
    );
  const missingDetailItems = props.mode === "edit"
    ? [
        !props.service.publicIntro?.trim() && "Veřejný úvod",
        !props.service.description?.trim() && "Detailní popis",
        props.service.idealFor.length === 0 && "Pro koho je služba vhodná",
        props.service.includes.length === 0 && "Co služba zahrnuje",
        props.service.benefits.length === 0 && "Přínosy služby",
        props.service.goodToKnow.length === 0 && "Dobré vědět",
        !props.service.seoTitle?.trim() && "SEO title",
        !props.service.seoDescription?.trim() && "SEO popis",
        !props.service.pricingShortDescription?.trim() && "Krátký popis do ceníku",
      ].filter((item): item is string => Boolean(item))
    : [];
  const showUnifiedTimeline = props.mode === "edit" && props.service._count.changeLogs > props.service._count.priceChangeLogs;
  const timelineItems = props.mode === "edit" && showUnifiedTimeline
    ? [
        ...props.service.changeLogs.map((log) => ({
          ...log,
          type: "change" as const,
        })),
        ...props.service.priceChangeLogs.map((log) => ({
          id: log.id,
          summary: `${formatServicePrice(log.oldPriceFromCzk)} → ${formatServicePrice(log.newPriceFromCzk)}`,
          createdAt: log.createdAt,
          createdAtLabel: log.createdAtLabel,
          actorUser: log.changedByUser,
          type: "price" as const,
        })),
      ].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    : [];

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
      startTransition(() => setIsDirty(false));
    }
  }, [serverState, startTransition]);

  useEffect(() => {
    const form = formRef.current;
    if (!form || initialSnapshotRef.current === undefined) return;

    setIsDirty(isFormDirty(initialSnapshotRef.current, getCurrentSnapshot(form)));
  }, [isActive, isPubliclyBookable]);

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
            <AdminStatePill tone={presentationStatus === "public" ? "active" : presentationStatus === "internal" ? "accent" : "muted"}>
              {servicePresentationStatusLabels[presentationStatus]}
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
        title="Základ a provoz"
        description="Nejdůležitější údaje pro rychlou práci v katalogu a rezervačním provozu."
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

          <Field
            label="Kategorie"
            error={serverState.fieldErrors?.categoryId}
            help="Určuje, ve které skupině se služba zobrazí v nabídce a ceníku."
          >
            <select
              name="categoryId"
              defaultValue={props.mode === "create" ? props.initialValues.categoryId : props.service.categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
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
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
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

        <div className="mt-4 border-t border-white/10 pt-4">
          <h5 className="text-sm font-medium text-white">Stav služby</h5>
          <p className="mt-1 text-xs leading-5 text-white/52">Zobrazuje současná pole jednodušeji; databázová pravidla se nemění.</p>
          <input type="hidden" name="isActive" value={String(isActive)} />
          <input type="hidden" name="isPubliclyBookable" value={String(isPubliclyBookable)} />
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {(["public", "internal", "inactive"] as const).map((status) => (
              <label key={status} className="flex cursor-pointer items-start gap-3 rounded-[1.1rem] border border-white/8 bg-white/5 p-4 has-[:checked]:border-[var(--color-accent)]/55 has-[:checked]:bg-[rgba(190,160,120,0.12)]">
                <input
                  type="radio"
                  name="presentationStatus"
                  value={status}
                  checked={presentationStatus === status}
                  onChange={() => {
                    const next = applyServicePresentationStatus({ isActive, isPubliclyBookable }, status);
                    setIsActive(next.isActive);
                    setIsPubliclyBookable(next.isPubliclyBookable);
                  }}
                  className="mt-1 h-4 w-4 border-white/20 bg-black/20 text-[var(--color-accent)]"
                />
                <span><span className="block text-sm font-medium text-white">{servicePresentationStatusLabels[status]}</span><span className="mt-1 block text-sm leading-6 text-white/66">{status === "public" ? "Aktivní a lze ji rezervovat online." : status === "internal" ? "Aktivní jen pro interní provoz, bez online rezervace." : "Vypnutá pro nové použití podle současných pravidel."}</span></span>
              </label>
            ))}
          </div>
          {presentationStatus === "inactive" && isPubliclyBookable ? <p className="mt-3 text-xs leading-5 text-white/52">Původní online režim zůstane uložený, aby se po opětovné aktivaci obnovil. Dokud je služba neaktivní, veřejně se nenabízí.</p> : null}
        </div>
      </SectionBlock>

      {props.mode === "edit" ? (
        <ServiceChangeImpact
          bookingCount={props.service._count.bookings}
          slotCount={props.service._count.allowedAvailabilitySlots}
          isBeingDeactivated={isBeingDeactivated}
          durationChanged={durationChanged}
          categoryIsActive={selectedCategory?.isActive ?? false}
          presentationStatus={presentationStatus}
        />
      ) : null}

      <SectionBlock
        title="Obsah na webu"
        description="Texty a strukturovaný detail, které klientka uvidí na webu a při výběru služby v rezervaci."
      >
        <div className="grid gap-4">
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
        <div className="mt-5 border-t border-white/10 pt-4">
          <h5 className="text-sm font-medium text-white">Strukturovaný detail</h5>
          <p className="mt-1 text-xs leading-5 text-white/52">Každý neprázdný řádek se na detailu služby zobrazí jako samostatný bod.</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
        </div>
      </SectionBlock>

      <SectionBlock
        title="Propagace"
        description="Volitelné zvýraznění služby v ceníku a na úvodní stránce."
        collapsible
      >
        <h5 className="text-sm font-medium text-white">Ceník</h5>
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
        <div className="mt-5 border-t border-white/10 pt-4">
          <h5 className="text-sm font-medium text-white">Homepage</h5>
          <p className="mt-1 text-xs leading-5 text-white/52">Zobrazí se nejvýše první tři doporučené služby podle pořadí.</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1.25fr)_180px] sm:items-start">
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
        </div>
      </SectionBlock>

      {props.mode === "edit" && missingDetailItems.length === 0 ? (
        <p className="text-sm font-medium text-white">Detail kompletní</p>
      ) : null}

      {props.mode === "edit" && missingDetailItems.length > 0 ? (
        <SectionBlock
          title="Úplnost detailu"
          description={`Doporučujeme doplnit ${missingDetailItems.length} položek`}
          collapsible
        >
          <ul className="grid gap-2 text-sm leading-6 text-white/72">
            {missingDetailItems.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </SectionBlock>
      ) : null}

      {isPublicService ? (
        <a
          href={`/sluzby/${encodeURIComponent(props.service.slug)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-full border border-white/16 px-3.5 py-2 text-sm font-semibold text-white transition hover:border-[var(--color-accent)]/70 hover:text-[var(--color-accent)]"
        >
          Zobrazit na webu
        </a>
      ) : null}

      {props.mode === "edit" ? (
        <SectionBlock
          title={showUnifiedTimeline ? "Historie změn" : "Historie ceny"}
          description={showUnifiedTimeline ? "Poslední úpravy služby a ceny včetně času a aktéra." : "Poslední auditní změny ceny služby včetně času a aktéra."}
          collapsible
        >
          {showUnifiedTimeline && timelineItems.length > 0 ? (
            <div className="grid gap-3">
              {timelineItems.map((log) => (
                <div
                  key={`${log.type}-${log.id}`}
                  className="rounded-[1.1rem] border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/72"
                >
                  <p className="font-medium text-white">
                    {log.summary}
                  </p>
                  <p className="mt-1 leading-6">
                    {log.createdAtLabel} • {log.actorUser?.name || log.actorUser?.email || "Systém / neznámý uživatel"}
                  </p>
                </div>
              ))}
            </div>
          ) : props.service.priceChangeLogs.length > 0 ? (
            <div className="grid gap-3">
              {props.service.priceChangeLogs.map((log) => (
                <div key={log.id} className="rounded-[1.1rem] border border-white/8 bg-black/20 px-4 py-3 text-sm text-white/72">
                  <p className="font-medium text-white">{formatServicePrice(log.oldPriceFromCzk)} -&gt; {formatServicePrice(log.newPriceFromCzk)}</p>
                  <p className="mt-1 leading-6">{log.createdAtLabel} • {log.changedByUser?.name || log.changedByUser?.email || "Systém / neznámý uživatel"}</p>
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
        title="SEO"
        description="Volitelný název a popis pro výsledek ve vyhledávání Google. Pokud je necháte prázdné, použije se běžný název a popis služby."
        collapsible
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
  collapsible = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  collapsible?: boolean;
}) {
  if (collapsible) {
    return (
      <details className="group rounded-[1.25rem] border border-white/8 bg-white/5" data-section={title}>
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4 marker:hidden [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block font-display text-xl text-white">{title}</span>
            <span className="mt-2 block text-sm leading-6 text-white/62">{description}</span>
          </span>
          <span aria-hidden="true" className="mt-1 text-lg text-white/55 transition-transform group-open:rotate-45">+</span>
        </summary>
        <div className="border-t border-white/10 p-4">{children}</div>
      </details>
    );
  }

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

function ServiceChangeImpact({
  bookingCount,
  slotCount,
  isBeingDeactivated,
  durationChanged,
  categoryIsActive,
  presentationStatus,
}: {
  bookingCount: number;
  slotCount: number;
  isBeingDeactivated: boolean;
  durationChanged: boolean;
  categoryIsActive: boolean;
  presentationStatus: ServicePresentationStatus;
}) {
  return (
    <section className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4" aria-live="polite">
      <h4 className="font-display text-xl text-white">Dopad změny</h4>
      <div className="mt-3 space-y-2 text-sm leading-6 text-white/72">
        <p>
          {bookingCount > 0
            ? `Služba má ${bookingCount} rezervací celkem.`
            : "U služby zatím nejsou evidované rezervace."} Existující rezervace ani jejich snapshoty názvu, délky a ceny se touto úpravou nemění.
        </p>
        <p>
          {slotCount > 0
            ? `Služba je navázaná na ${slotCount} ${slotCount === 1 ? "slot" : "slotů"} dostupnosti.`
            : "Služba nyní nemá přímou vazbu na sloty dostupnosti."} Stav služby existující sloty nemění; projeví se až při posuzování nových rezervací.
        </p>
        {presentationStatus === "public" && !categoryIsActive ? <p className="text-amber-100">Kategorie je neaktivní, proto se služba přes zvolený veřejný stav zatím neukáže na webu ani v online rezervaci.</p> : null}
        {isBeingDeactivated ? <p className="text-amber-100">Po uložení službu nepůjde použít pro nové rezervace. Již vytvořené rezervace zůstanou beze změny.</p> : null}
        {durationChanged ? <p className="text-amber-100">Nová délka se použije jen pro nově vytvořené rezervace a výpočet jejich dostupnosti. Termíny stávajících rezervací se nepřepočítají.</p> : null}
      </div>
    </section>
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
