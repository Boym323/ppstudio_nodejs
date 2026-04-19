"use client";

import { useActionState } from "react";

import {
  initialUpdateBookingSettingsActionState,
} from "@/features/admin/actions/update-booking-settings-action-state";
import { updateBookingSettingsAction } from "@/features/admin/actions/settings-actions";

import {
  SettingsField,
  SettingsFormFooter,
  SettingsFormMessages,
  settingsControlClassName,
  SettingsSection,
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
      <SettingsFormMessages serverState={serverState} />

      <SettingsSection
        title="Globální pravidla rezervace"
        description="Jen pravidla, která platí pro celý booking."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <SettingsField
            label="Předstih před rezervací"
            hint="Kolik hodin před začátkem termínu ještě dovolíte novou rezervaci."
            error={serverState.fieldErrors?.bookingMinAdvanceHours}
          >
            <input
              type="number"
              name="bookingMinAdvanceHours"
              min={0}
              max={168}
              step={1}
              inputMode="numeric"
              defaultValue={settings.bookingMinAdvanceHours}
              className={settingsControlClassName}
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
              step={1}
              inputMode="numeric"
              defaultValue={settings.bookingMaxAdvanceDays}
              className={settingsControlClassName}
            />
          </SettingsField>

          <SettingsField
            label="Storno do"
            hint="Kolik hodin před termínem ještě jde rezervaci zrušit přes e-mail."
            error={serverState.fieldErrors?.bookingCancellationHours}
          >
            <input
              type="number"
              name="bookingCancellationHours"
              min={0}
              max={336}
              step={1}
              inputMode="numeric"
              defaultValue={settings.bookingCancellationHours}
              className={settingsControlClassName}
            />
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsFormFooter note="Změny se použijí pro nové rezervace. Už uložené termíny tím neměníš." />
    </form>
  );
}
