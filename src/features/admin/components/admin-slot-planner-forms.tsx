"use client";

import {
  AvailabilitySlotServiceRestrictionMode,
  AvailabilitySlotStatus,
} from "@prisma/client";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { type AdminArea } from "@/config/navigation";
import {
  type BatchCreateSlotsActionState,
  createSlotBatchAction,
  type UpsertSlotActionState,
  upsertSlotAction,
} from "@/features/admin/actions/slot-actions";
import { type AdminSlotPlannerSlot } from "@/features/admin/lib/admin-slots";

const initialUpsertState: UpsertSlotActionState = {
  status: "idle",
};

const initialBatchState: BatchCreateSlotsActionState = {
  status: "idle",
};

function addMinutes(inputValue: string, minutes: number) {
  const parsed = new Date(inputValue);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  parsed.setMinutes(parsed.getMinutes() + minutes);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const mins = String(parsed.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${mins}`;
}

function useRedirectOnSuccess(
  state: { status: "idle" | "error" | "success"; redirectTo?: string },
) {
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [router, state]);
}

export function AdminQuickCreateSlotForm({
  area,
  startsAtInput,
  endsAtInput,
  returnTo,
}: {
  area: AdminArea;
  startsAtInput: string;
  endsAtInput: string;
  returnTo: string;
}) {
  const [state, formAction] = useActionState(upsertSlotAction, initialUpsertState);
  const [startsAt, setStartsAt] = useState(startsAtInput);
  const [endsAt, setEndsAt] = useState(endsAtInput);
  const isSalon = area === "salon";

  useRedirectOnSuccess(state);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="slotId" value="" />
      <input type="hidden" name="serviceRestrictionMode" value={AvailabilitySlotServiceRestrictionMode.ANY} />
      <input type="hidden" name="publicNote" value="" />
      <input type="hidden" name="internalNote" value="" />
      <input type="hidden" name="returnTo" value={returnTo} />
      {isSalon ? <input type="hidden" name="status" value={AvailabilitySlotStatus.PUBLISHED} /> : null}

      {state.status === "error" && state.formError ? (
        <div className="rounded-[1rem] border border-red-300/25 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-50">
          {state.formError}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-white">Začátek</span>
          <input
            type="datetime-local"
            name="startsAt"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[var(--color-accent)]/60"
          />
          {state.fieldErrors?.startsAt ? (
            <p className="mt-2 text-sm text-red-300">{state.fieldErrors.startsAt}</p>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-white">Konec</span>
          <input
            type="datetime-local"
            name="endsAt"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[var(--color-accent)]/60"
          />
          {state.fieldErrors?.endsAt ? (
            <p className="mt-2 text-sm text-red-300">{state.fieldErrors.endsAt}</p>
          ) : null}
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {[30, 60, 90, 120].map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => setEndsAt(addMinutes(startsAt, minutes))}
            className="rounded-full border border-white/14 bg-white/6 px-3 py-2 text-sm text-white/85 transition hover:border-white/25 hover:text-white"
          >
            +{minutes} min
          </button>
        ))}
      </div>

      {isSalon ? (
        <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-sm font-medium text-white">Stav</p>
          <p className="mt-2 text-sm leading-6 text-white/66">Provozní vložení se rovnou publikuje.</p>
        </div>
      ) : (
        <label className="block">
          <span className="text-sm font-medium text-white">Stav</span>
          <select
            name="status"
            defaultValue={AvailabilitySlotStatus.DRAFT}
            className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[var(--color-accent)]/60"
          >
            <option value={AvailabilitySlotStatus.DRAFT} className="text-black">
              Rozpracovaný
            </option>
            <option value={AvailabilitySlotStatus.PUBLISHED} className="text-black">
              Publikovaný
            </option>
            <option value={AvailabilitySlotStatus.CANCELLED} className="text-black">
              Zrušený
            </option>
          </select>
        </label>
      )}

      <p className="text-sm leading-6 text-white/64">
        Vloží se jednoduchý dostupný slot bez omezení služeb a bez kapacity v rozhraní. Detaily lze doplnit později.
      </p>

      <PlannerSubmitButton label="Přidat slot" pendingLabel="Ukládám slot..." />
    </form>
  );
}

export function AdminBatchCreateSlotForm({
  area,
  day,
  suggestedStartsAtInput,
  returnTo,
}: {
  area: AdminArea;
  day: string;
  suggestedStartsAtInput: string;
  returnTo: string;
}) {
  const [state, formAction] = useActionState(createSlotBatchAction, initialBatchState);
  const isSalon = area === "salon";

  useRedirectOnSuccess(state);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="day" value={day} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {isSalon ? <input type="hidden" name="status" value={AvailabilitySlotStatus.PUBLISHED} /> : null}

      {state.status === "error" && state.formError ? (
        <div className="rounded-[1rem] border border-red-300/25 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-50">
          {state.formError}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-white">První čas</span>
          <input
            type="time"
            name="startTime"
            defaultValue={suggestedStartsAtInput.slice(11, 16)}
            className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[var(--color-accent)]/60"
          />
          {state.fieldErrors?.startTime ? (
            <p className="mt-2 text-sm text-red-300">{state.fieldErrors.startTime}</p>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-white">Počet slotů</span>
          <input
            type="number"
            name="slotCount"
            min={1}
            max={12}
            defaultValue={3}
            className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[var(--color-accent)]/60"
          />
          {state.fieldErrors?.slotCount ? (
            <p className="mt-2 text-sm text-red-300">{state.fieldErrors.slotCount}</p>
          ) : null}
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-white">Délka</span>
          <input
            type="number"
            name="slotLengthMinutes"
            min={15}
            step={15}
            defaultValue={60}
            className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[var(--color-accent)]/60"
          />
          {state.fieldErrors?.slotLengthMinutes ? (
            <p className="mt-2 text-sm text-red-300">{state.fieldErrors.slotLengthMinutes}</p>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-white">Mezera</span>
          <input
            type="number"
            name="gapMinutes"
            min={0}
            step={5}
            defaultValue={15}
            className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[var(--color-accent)]/60"
          />
          {state.fieldErrors?.gapMinutes ? (
            <p className="mt-2 text-sm text-red-300">{state.fieldErrors.gapMinutes}</p>
          ) : null}
        </label>
      </div>

      {isSalon ? (
        <div className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-white/66">
          Série se v provozním režimu rovnou publikuje.
        </div>
      ) : (
        <label className="block">
          <span className="text-sm font-medium text-white">Stav série</span>
          <select
            name="status"
            defaultValue={AvailabilitySlotStatus.DRAFT}
            className="mt-2 w-full rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-[var(--color-accent)]/60"
          >
            <option value={AvailabilitySlotStatus.DRAFT} className="text-black">
              Rozpracovaný
            </option>
            <option value={AvailabilitySlotStatus.PUBLISHED} className="text-black">
              Publikovaný
            </option>
            <option value={AvailabilitySlotStatus.CANCELLED} className="text-black">
              Zrušený
            </option>
          </select>
        </label>
      )}

      <p className="text-sm leading-6 text-white/64">
        Série je určená pro rychlé založení více jednoduchých slotů v jednom dni. Poznámky a omezení služeb lze doplnit až podle potřeby u konkrétních slotů.
      </p>

      <PlannerSubmitButton label="Vytvořit sérii slotů" pendingLabel="Zakládám sérii..." />
    </form>
  );
}

export function AdminSlotQuickEditForm({
  area,
  slot,
  returnTo,
}: {
  area: AdminArea;
  slot: AdminSlotPlannerSlot;
  returnTo: string;
}) {
  const [state, formAction] = useActionState(upsertSlotAction, initialUpsertState);
  const [startsAt, setStartsAt] = useState(slot.startsAtInput);
  const [endsAt, setEndsAt] = useState(slot.endsAtInput);

  useRedirectOnSuccess(state);

  return (
    <form action={formAction} className="space-y-4 rounded-[1rem] border border-white/10 bg-black/15 p-4">
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="slotId" value={slot.id} />
      <input type="hidden" name="status" value={slot.status} />
      <input type="hidden" name="serviceRestrictionMode" value={slot.serviceRestrictionMode} />
      <input type="hidden" name="publicNote" value={slot.publicNote ?? ""} />
      <input type="hidden" name="internalNote" value={slot.internalNote ?? ""} />
      <input type="hidden" name="capacity" value={String(slot.capacity)} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {slot.serviceIds.map((serviceId) => (
        <input key={serviceId} type="hidden" name="serviceIds" value={serviceId} />
      ))}

      {state.status === "error" && state.formError ? (
        <div className="rounded-[0.9rem] border border-red-300/25 bg-red-400/10 px-3 py-2 text-sm leading-6 text-red-50">
          {state.formError}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-white">Začátek</span>
          <input
            type="datetime-local"
            name="startsAt"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            className="mt-2 w-full rounded-[0.9rem] border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--color-accent)]/60"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-white">Konec</span>
          <input
            type="datetime-local"
            name="endsAt"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            className="mt-2 w-full rounded-[0.9rem] border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--color-accent)]/60"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {[30, 60, 90].map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => setEndsAt(addMinutes(startsAt, minutes))}
            className="rounded-full border border-white/14 bg-white/6 px-3 py-2 text-sm text-white/85 transition hover:border-white/25 hover:text-white"
          >
            +{minutes} min
          </button>
        ))}
      </div>

      <PlannerSubmitButton label="Uložit čas" pendingLabel="Ukládám změnu..." />
    </form>
  );
}

function PlannerSubmitButton({
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
      className="w-full rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
