"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { type AdminArea } from "@/config/navigation";
import {
  initialUpdateServiceActionState,
} from "@/features/admin/actions/update-service-action-state";
import { updateServiceAction } from "@/features/admin/actions/service-actions";
import { formatServicePrice } from "@/features/admin/lib/admin-service-format";

export function AdminServiceForm({
  area,
  service,
  categories,
}: {
  area: AdminArea;
  service: {
    id: string;
    name: string;
    shortDescription: string | null;
    description: string | null;
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
  };
  categories: Array<{
    id: string;
    name: string;
    isActive: boolean;
    sortOrder: number;
  }>;
}) {
  const [serverState, formAction] = useActionState(
    updateServiceAction,
    initialUpdateServiceActionState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="serviceId" value={service.id} />

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

      <div className="grid gap-3 rounded-[1.25rem] border border-white/8 bg-white/5 p-4 text-sm text-white/70 sm:grid-cols-3">
        <p><span className="text-white">Kategorie:</span> {service.category.name}</p>
        <p><span className="text-white">Rezervace:</span> {service._count.bookings}</p>
        <p><span className="text-white">Omezení slotů:</span> {service._count.allowedAvailabilitySlots}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Název služby" error={serverState.fieldErrors?.name}>
          <input
            type="text"
            name="name"
            defaultValue={service.name}
            maxLength={120}
            className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
          />
        </Field>

        <Field label="Kategorie" error={serverState.fieldErrors?.categoryId}>
          <select
            name="categoryId"
            defaultValue={service.categoryId}
            className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id} className="text-black">
                {category.name}{category.isActive ? "" : " (neaktivní)"}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Délka v minutách" error={serverState.fieldErrors?.durationMinutes}>
          <input
            type="number"
            name="durationMinutes"
            min={5}
            max={480}
            defaultValue={service.durationMinutes}
            className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
          />
        </Field>

        <Field label="Cena od (Kč)" error={serverState.fieldErrors?.priceFromCzk}>
          <input
            type="number"
            name="priceFromCzk"
            min={0}
            max={50000}
            defaultValue={service.priceFromCzk ?? ""}
            placeholder="Např. 1200"
            className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
          />
        </Field>

        <Field label="Pořadí" error={serverState.fieldErrors?.sortOrder}>
          <input
            type="number"
            name="sortOrder"
            min={0}
            max={9999}
            defaultValue={service.sortOrder}
            className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
          />
        </Field>

        <div className="rounded-[1.1rem] border border-white/8 bg-white/5 p-4 text-sm text-white/72">
          <p className="font-medium text-white">Aktuální veřejná cena</p>
          <p className="mt-2 text-lg text-[var(--color-accent-soft)]">{formatServicePrice(service.priceFromCzk)}</p>
          <p className="mt-2 leading-6">
            Booking používá aktuální délku služby pro nové rezervace. Historické rezervace si nechávají vlastní snapshot.
          </p>
        </div>
      </div>

      <Field label="Krátký popis" error={serverState.fieldErrors?.shortDescription}>
        <textarea
          name="shortDescription"
          rows={3}
          maxLength={240}
          defaultValue={service.shortDescription ?? ""}
          placeholder="Krátký popis pro rychlou orientaci v nabídce."
          className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
        />
      </Field>

      <Field label="Detailní popis" error={serverState.fieldErrors?.description}>
        <textarea
          name="description"
          rows={6}
          maxLength={4000}
          defaultValue={service.description ?? ""}
          placeholder="Detailní poznámka k průběhu služby nebo tomu, co obsahuje."
          className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <ToggleCard
          name="isActive"
          defaultChecked={service.isActive}
          title="Služba je aktivní"
          description="Aktivní služba zůstává použitelná v navazující provozní logice a může být dál napojená na sloty."
        />
        <ToggleCard
          name="isPubliclyBookable"
          defaultChecked={service.isPubliclyBookable}
          title="Veřejně rezervovatelná"
          description="Pouze aktivní a veřejně rezervovatelná služba se objeví ve veřejném booking flow."
        />
      </div>

      <SubmitButton />
    </form>
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

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Ukládám službu..." : "Uložit službu"}
    </button>
  );
}
