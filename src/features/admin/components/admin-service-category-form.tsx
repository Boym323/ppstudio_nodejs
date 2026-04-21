"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { type AdminArea } from "@/config/navigation";
import {
  createServiceCategoryAction,
  deleteServiceCategoryAction,
  updateServiceCategoryAction,
} from "@/features/admin/actions/service-category-actions";
import {
  initialUpdateServiceCategoryActionState,
} from "@/features/admin/actions/update-service-category-action-state";
import { AdminStatePill } from "@/features/admin/components/admin-state-pill";

type BaseCategoryProps = {
  area: AdminArea;
  currentPath: string;
  servicesPath: string;
  returnTo: string;
};

type EditCategoryProps = BaseCategoryProps & {
  mode: "edit";
  category: {
    id: string;
    name: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
    warnings: string[];
    counts: {
      total: number;
      active: number;
      public: number;
    };
    _count: {
      services: number;
    };
    services: Array<{
      id: string;
      name: string;
      sortOrder: number;
      isActive: boolean;
      isPubliclyBookable: boolean;
    }>;
  };
};

type CreateCategoryProps = BaseCategoryProps & {
  mode: "create";
  initialValues: {
    name: string;
    description: string;
    isActive: boolean;
  };
};

export function AdminServiceCategoryForm(props: EditCategoryProps | CreateCategoryProps) {
  const [serverState, formAction] = useActionState(
    props.mode === "create" ? createServiceCategoryAction : updateServiceCategoryAction,
    initialUpdateServiceCategoryActionState,
  );

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="area" value={props.area} />
        <input type="hidden" name="returnTo" value={props.returnTo} />
        {props.mode === "edit" ? <input type="hidden" name="categoryId" value={props.category.id} /> : null}

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
              <AdminStatePill tone={props.category.isActive ? "active" : "muted"}>
                {props.category.isActive ? "Aktivní" : "Neaktivní"}
              </AdminStatePill>
              <AdminStatePill tone="accent">Pořadí #{props.category.sortOrder}</AdminStatePill>
              <AdminStatePill tone={props.category.counts.total > 0 ? "accent" : "muted"}>
                {props.category.counts.total > 0 ? `${props.category.counts.total} služeb` : "Prázdná"}
              </AdminStatePill>
            </>
          ) : (
            <>
              <AdminStatePill tone="accent">Nová kategorie</AdminStatePill>
              <AdminStatePill tone="muted">Připraví se pro další služby</AdminStatePill>
            </>
          )}
        </div>

        {props.mode === "edit" && props.category.warnings.length > 0 ? (
          <section className="rounded-[1.25rem] border border-amber-300/20 bg-amber-400/10 p-4">
            <h4 className="font-display text-xl text-white">Provozní upozornění</h4>
            <div className="mt-3 grid gap-2">
              {props.category.warnings.map((warning) => (
                <p key={warning} className="text-sm leading-6 text-amber-50">{warning}</p>
              ))}
            </div>
          </section>
        ) : null}

        <SectionBlock
          title="Základ kategorie"
          description="Lehký formulář pro rychlé přeuspořádání a čistou orientaci v katalogu."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Název kategorie" error={serverState.fieldErrors?.name}>
              <input
                type="text"
                name="name"
                defaultValue={props.mode === "create" ? props.initialValues.name : props.category.name}
                maxLength={120}
                className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
              />
            </Field>

            {props.mode === "edit" ? (
              <Field label="Pořadí" error={serverState.fieldErrors?.sortOrder}>
                <input
                  type="number"
                  name="sortOrder"
                  min={0}
                  max={9999}
                  step={1}
                  inputMode="numeric"
                  defaultValue={props.category.sortOrder}
                  className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
                />
              </Field>
            ) : null}

            <Field
              label="Krátký popis"
              error={serverState.fieldErrors?.description}
              className="sm:col-span-2"
            >
              <textarea
                name="description"
                rows={3}
                maxLength={1000}
                defaultValue={props.mode === "create" ? props.initialValues.description : props.category.description ?? ""}
                placeholder="Volitelné. Pomáhá jen tam, kde usnadní rychlou orientaci."
                className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
              />
            </Field>
          </div>
        </SectionBlock>

        <SectionBlock
          title="Viditelnost"
          description="Vypnutí kategorii bezpečně schová, ale navázané služby ponechá beze změny."
        >
          <ToggleCard
            name="isActive"
            defaultChecked={props.mode === "create" ? props.initialValues.isActive : props.category.isActive}
            title="Aktivní kategorie"
            description="Použijte, když má kategorie zůstat v běžné nabídce a veřejných výpisech."
          />
        </SectionBlock>

        {props.mode === "edit" ? (
          <SectionBlock
            title="Navázané služby"
            description={
              props.category._count.services > 0
                ? "Kategorie už je v provozu. Níže vidíte rychlý kontext nejbližších navázaných služeb."
                : "Kategorie zatím neobsahuje žádnou službu."
            }
          >
            <div className="grid gap-3 text-sm text-white/70 sm:grid-cols-3">
              <p><span className="text-white">Aktivní služby:</span> {props.category.counts.active}</p>
              <p><span className="text-white">Veřejné služby:</span> {props.category.counts.public}</p>
              <p><span className="text-white">Celkem:</span> {props.category.counts.total}</p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={`${props.servicesPath}?mode=create&category=${props.category.id}`}
                className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
              >
                Vytvořit službu v této kategorii
              </a>
              <a
                href={`${props.servicesPath}?category=${props.category.id}`}
                className="rounded-full border border-white/10 px-5 py-3 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6"
              >
                Otevřít služby této kategorie
              </a>
            </div>

            {props.category.services.length > 0 ? (
              <div className="mt-4 grid gap-2">
                {props.category.services.map((service) => (
                  <div
                    key={service.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[1.1rem] border border-white/8 bg-black/10 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{service.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/48">
                        Pořadí {service.sortOrder}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <AdminStatePill tone={service.isActive ? "active" : "muted"}>
                        {service.isActive ? "Aktivní" : "Skrytá"}
                      </AdminStatePill>
                      <AdminStatePill tone={service.isPubliclyBookable ? "active" : "muted"}>
                        {service.isPubliclyBookable ? "Veřejná" : "Interní"}
                      </AdminStatePill>
                    </div>
                  </div>
                ))}

                {props.category._count.services > props.category.services.length ? (
                  <p className="text-sm leading-6 text-white/62">
                    Zobrazen je jen rychlý náhled prvních {props.category.services.length} služeb.
                  </p>
                ) : null}
              </div>
            ) : null}
          </SectionBlock>
        ) : null}

        <SubmitButtons isCreate={props.mode === "create"} />
      </form>

      {props.mode === "edit" ? (
        <SectionBlock
          title="Odstranění"
          description={
            props.category._count.services > 0
              ? "Mazání je schválně zablokované, dokud jsou v kategorii služby."
              : "Prázdnou kategorii lze odstranit, pokud si ji už nechcete nechávat pro později."
          }
        >
          {props.category._count.services > 0 ? (
            <p className="rounded-[1.15rem] border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50">
              Kategorie obsahuje {props.category._count.services} služeb, takže mazání není dostupné. Pro běžný provoz je lepší ji jen vypnout.
            </p>
          ) : (
            <div className="flex flex-col gap-3 rounded-[1.15rem] border border-white/8 bg-black/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-white/72">
                Kategorii můžete smazat, protože je prázdná. Pokud si ji chcete nechat pro později, stačí ji vypnout.
              </p>
              <form action={deleteServiceCategoryAction}>
                <input type="hidden" name="area" value={props.area} />
                <input type="hidden" name="categoryId" value={props.category.id} />
                <input type="hidden" name="currentPath" value={props.currentPath} />
                <button
                  type="submit"
                  className="rounded-full border border-red-300/30 bg-red-400/10 px-5 py-3 text-sm font-semibold text-red-50 transition hover:border-red-200/40 hover:bg-red-400/14"
                >
                  Smazat kategorii
                </button>
              </form>
            </div>
          )}
        </SectionBlock>
      ) : null}
    </div>
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
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="text-sm font-medium text-white">{label}</span>
      {children}
      {error ? <p className="mt-2 text-sm text-red-200">{error}</p> : null}
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
    <label className="flex cursor-pointer items-start gap-4 rounded-[1.1rem] border border-white/8 bg-black/10 p-4">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 h-5 w-5 rounded border-white/20 bg-black/30 text-[var(--color-accent)]"
      />
      <span className="block">
        <span className="block text-sm font-medium text-white">{title}</span>
        <span className="mt-2 block text-sm leading-6 text-white/62">{description}</span>
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
        {pending ? (isCreate ? "Vytvářím kategorii..." : "Ukládám kategorii...") : isCreate ? "Vytvořit kategorii" : "Uložit"}
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
