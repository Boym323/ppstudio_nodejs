"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { type AdminArea } from "@/config/navigation";
import { AdminStatePill } from "@/features/admin/components/admin-state-pill";
import {
  initialUpdateServiceCategoryActionState,
} from "@/features/admin/actions/update-service-category-action-state";
import {
  deleteServiceCategoryAction,
  updateServiceCategoryAction,
} from "@/features/admin/actions/service-category-actions";

export function AdminServiceCategoryForm({
  area,
  currentPath,
  category,
}: {
  area: AdminArea;
  currentPath: string;
  category: {
    id: string;
    name: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
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
}) {
  const [serverState, formAction] = useActionState(
    updateServiceCategoryAction,
    initialUpdateServiceCategoryActionState,
  );

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="area" value={area} />
        <input type="hidden" name="categoryId" value={category.id} />

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
          <AdminStatePill tone={category.isActive ? "active" : "muted"}>
            {category.isActive ? "Aktivní" : "Skrytá"}
          </AdminStatePill>
          <AdminStatePill tone="accent">Pořadí {category.sortOrder}</AdminStatePill>
          <AdminStatePill tone={category._count.services > 0 ? "accent" : "muted"}>
            {category._count.services > 0 ? `${category._count.services} služeb` : "Prázdná"}
          </AdminStatePill>
        </div>

        <SectionBlock
          title="Základ kategorie"
          description="Stačí upravit název a číslo pořadí. Popis je jen doplněk, když pomůže rychlé orientaci."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Název kategorie" error={serverState.fieldErrors?.name}>
              <input
                type="text"
                name="name"
                defaultValue={category.name}
                maxLength={120}
                className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
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
                defaultValue={category.sortOrder}
                className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
              />
            </Field>

            <Field
              label="Krátký popis"
              error={serverState.fieldErrors?.description}
              className="sm:col-span-2"
            >
              <textarea
                name="description"
                rows={3}
                maxLength={1000}
                defaultValue={category.description ?? ""}
                placeholder="Volitelné. Hodí se jen tehdy, když pomůže rychlé orientaci."
                className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
              />
            </Field>
          </div>
        </SectionBlock>

        <SectionBlock
          title="Viditelnost"
          description="Vypnutí kategorii bezpečně schová, ale navázané služby zůstávají v databázi beze změny."
        >
          <ToggleCard
            name="isActive"
            defaultChecked={category.isActive}
            title="Aktivní kategorie"
            description="Použijte, když má kategorie zůstat v běžné nabídce a veřejných výpisech."
          />
        </SectionBlock>

      <SectionBlock
        title="Navázané služby"
        description={
          category._count.services > 0
            ? "Tahleta kategorie je už v provozu. Uvedené služby zůstanou zachované i při vypnutí kategorie."
            : "Tahleta kategorie je prázdná a lze ji případně bezpečně smazat."
        }
      >
      {category.services.length > 0 ? (
          <div className="grid gap-2">
            {category.services.map((service) => (
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

            {category._count.services > category.services.length ? (
              <p className="text-sm leading-6 text-white/62">
                Zobrazeno je jen prvních {category.services.length} služeb.
              </p>
            ) : null}
          </div>
          ) : (
            <div className="rounded-[1.15rem] border border-dashed border-white/14 bg-white/4 p-4 text-sm leading-6 text-white/62">
              Tahle kategorie zatím neobsahuje žádnou službu.
            </div>
          )}
        </SectionBlock>

        <SubmitButton label="Uložit kategorii" pendingLabel="Ukládám..." />
      </form>

      <SectionBlock
        title="Odstranění"
        description={
          category._count.services > 0
            ? "Mazání je schválně zablokované, dokud jsou v kategorii služby."
            : "Prázdnou kategorii lze odstranit, pokud si ji už nechcete nechat pro později."
        }
      >
        {category._count.services > 0 ? (
          <p className="rounded-[1.15rem] border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-50">
            Kategorie obsahuje {category._count.services} služeb, takže mazání není dostupné. Pro běžný provoz je lepší ji jen vypnout.
          </p>
        ) : (
          <div className="flex flex-col gap-3 rounded-[1.15rem] border border-white/8 bg-black/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-white/72">
              Kategorii můžete smazat, protože je prázdná. Pokud ji chcete používat později, stačí ji nechat vypnutou.
            </p>
            <form action={deleteServiceCategoryAction}>
              <input type="hidden" name="area" value={area} />
              <input type="hidden" name="categoryId" value={category.id} />
              <input type="hidden" name="currentPath" value={currentPath} />
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

function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  return <SubmitButtonInner label={label} pendingLabel={pendingLabel} />;
}

function SubmitButtonInner({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
