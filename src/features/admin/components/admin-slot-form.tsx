"use client";

import {
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
} from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useActionState } from "react";
import { useFormStatus } from "react-dom";

import { type AdminArea } from "@/config/navigation";
import {
  type UpsertSlotActionState,
  upsertSlotAction,
} from "@/features/admin/actions/slot-actions";

type AdminSlotFormProps = {
  area: AdminArea;
  mode: "create" | "edit";
  slotId?: string;
  defaultValues?: {
    startsAtInput: string;
    endsAtInput: string;
    capacity: number;
    status: AvailabilitySlotStatus;
    serviceRestrictionMode: AvailabilitySlotServiceRestrictionMode;
    publicNote: string;
    internalNote: string;
    serviceIds: string[];
  } | null;
  services: Array<{
    id: string;
    name: string;
    durationMinutes: number;
    category: {
      name: string;
    };
  }>;
};

export function AdminSlotForm({
  area,
  mode,
  slotId,
  defaultValues,
  services,
}: AdminSlotFormProps) {
  const router = useRouter();
  const [serverState, formAction] = useActionState(upsertSlotAction, initialState);

  useEffect(() => {
    if (serverState.status === "success" && serverState.redirectTo) {
      router.push(serverState.redirectTo);
      router.refresh();
    }
  }, [router, serverState]);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="slotId" value={slotId ?? ""} />

      {serverState.status === "error" && serverState.formError ? (
        <div className="rounded-[1.25rem] border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-50">
          {serverState.formError}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-white">Začátek slotu</span>
          <input
            type="datetime-local"
            name="startsAt"
            defaultValue={defaultValues?.startsAtInput ?? ""}
            className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
          />
          {serverState.fieldErrors?.startsAt ? (
            <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.startsAt}</p>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-white">Konec slotu</span>
          <input
            type="datetime-local"
            name="endsAt"
            defaultValue={defaultValues?.endsAtInput ?? ""}
            className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
          />
          {serverState.fieldErrors?.endsAt ? (
            <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.endsAt}</p>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-white">Kapacita</span>
          <input
            type="number"
            name="capacity"
            min={1}
            defaultValue={defaultValues?.capacity ?? 1}
            className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
          />
          {serverState.fieldErrors?.capacity ? (
            <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.capacity}</p>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-white">Stav slotu</span>
          <select
            name="status"
            defaultValue={defaultValues?.status ?? AvailabilitySlotStatus.DRAFT}
            className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
          >
            <option value={AvailabilitySlotStatus.DRAFT} className="text-black">
              Rozpracovaný
            </option>
            <option value={AvailabilitySlotStatus.PUBLISHED} className="text-black">
              Publikovaný
            </option>
            <option value={AvailabilitySlotStatus.CANCELLED} className="text-black">
              Blokovaný
            </option>
            <option value={AvailabilitySlotStatus.ARCHIVED} className="text-black">
              Archivovaný
            </option>
          </select>
          {serverState.fieldErrors?.status ? (
            <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.status}</p>
          ) : null}
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-white">Režim služeb</span>
        <select
          name="serviceRestrictionMode"
          defaultValue={
            defaultValues?.serviceRestrictionMode ?? AvailabilitySlotServiceRestrictionMode.ANY
          }
          className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
        >
          <option value={AvailabilitySlotServiceRestrictionMode.ANY} className="text-black">
            Bez omezení služeb
          </option>
          <option
            value={AvailabilitySlotServiceRestrictionMode.SELECTED}
            className="text-black"
          >
            Jen vybrané služby
          </option>
        </select>
      </label>

      <fieldset className="rounded-[1.4rem] border border-white/10 bg-white/4 p-4">
        <legend className="px-2 text-sm font-medium text-white">Povolené služby</legend>
        <p className="mt-1 text-sm leading-6 text-white/64">
          Pokud zvolíš režim „Jen vybrané služby“, server vyžaduje alespoň jednu aktivní službu.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {services.map((service) => (
            <label
              key={service.id}
              className="flex items-start gap-3 rounded-[1.1rem] border border-white/8 bg-black/10 px-4 py-3"
            >
              <input
                type="checkbox"
                name="serviceIds"
                value={service.id}
                defaultChecked={defaultValues?.serviceIds.includes(service.id)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-black/30 text-[var(--color-accent)]"
              />
              <span className="block">
                <span className="block text-sm font-medium text-white">{service.name}</span>
                <span className="mt-1 block text-sm leading-6 text-white/60">
                  {service.category.name} • {service.durationMinutes} min
                </span>
              </span>
            </label>
          ))}
        </div>
        {serverState.fieldErrors?.serviceIds ? (
          <p className="mt-3 text-sm text-red-300">{serverState.fieldErrors.serviceIds}</p>
        ) : null}
      </fieldset>

      <label className="block">
        <span className="text-sm font-medium text-white">Veřejná poznámka</span>
        <textarea
          name="publicNote"
          rows={3}
          maxLength={240}
          defaultValue={defaultValues?.publicNote ?? ""}
          placeholder="Krátká poznámka viditelná v rezervačním flow."
          className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
        />
        {serverState.fieldErrors?.publicNote ? (
          <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.publicNote}</p>
        ) : null}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-white">Interní poznámka</span>
        <textarea
          name="internalNote"
          rows={4}
          maxLength={1000}
          defaultValue={defaultValues?.internalNote ?? ""}
          placeholder="Poznámka jen pro tým salonu."
          className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
        />
        {serverState.fieldErrors?.internalNote ? (
          <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.internalNote}</p>
        ) : null}
      </label>

      <SubmitButton mode={mode} />
    </form>
  );
}

const initialState: UpsertSlotActionState = {
  status: "idle",
};

function SubmitButton({ mode }: { mode: "create" | "edit" }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending
        ? "Ukládám..."
        : mode === "create"
          ? "Vytvořit slot"
          : "Uložit úpravy"}
    </button>
  );
}
