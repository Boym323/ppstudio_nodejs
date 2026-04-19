"use client";

import { useActionState } from "react";

import {
  initialUpdateBookingSettingsActionState,
} from "@/features/admin/actions/update-booking-settings-action-state";
import { updateBookingSettingsAction } from "@/features/admin/actions/settings-actions";

import {
  SettingsField,
  SettingsSection,
  SettingsStatus,
  SettingsSubmitButton,
} from "./admin-settings-form-ui";

export function AdminBookingSettingsForm({
  settings,
}: {
  settings: {
    bookingMinAdvanceHours: number;
    bookingMaxAdvanceDays: number;
    bookingCancellationHours: number;
  };
}) {
  const [serverState, formAction] = useActionState(
    updateBookingSettingsAction,
    initialUpdateBookingSettingsActionState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <SettingsStatus status="success" message={serverState.status === "success" ? serverState.successMessage : undefined} />
      <SettingsStatus status="error" message={serverState.status === "error" ? serverState.formError : undefined} />

      <SettingsSection
        title="Globální pravidla rezervace"
        description="Platí pro celý booking. Tímto nenahrazujete správu služeb ani volných termínů."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <SettingsField
            label="Minimální předstih"
            hint="Kolik hodin před začátkem termínu ještě dovolíte novou rezervaci."
            error={serverState.fieldErrors?.bookingMinAdvanceHours}
          >
            <input
              type="number"
              name="bookingMinAdvanceHours"
              min={0}
              max={168}
              defaultValue={settings.bookingMinAdvanceHours}
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
            />
          </SettingsField>

          <SettingsField
            label="Rezervace dopředu"
            hint="Kolik dní dopředu může klientka vybírat termín."
            error={serverState.fieldErrors?.bookingMaxAdvanceDays}
          >
            <input
              type="number"
              name="bookingMaxAdvanceDays"
              min={1}
              max={365}
              defaultValue={settings.bookingMaxAdvanceDays}
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
            />
          </SettingsField>

          <SettingsField
            label="Storno limit"
            hint="Kolik hodin před termínem ještě dovolíte storno přes odkaz v e-mailu."
            error={serverState.fieldErrors?.bookingCancellationHours}
          >
            <input
              type="number"
              name="bookingCancellationHours"
              min={0}
              max={336}
              defaultValue={settings.bookingCancellationHours}
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
            />
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsSubmitButton />
    </form>
  );
}
