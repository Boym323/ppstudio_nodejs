"use client";

import { useActionState } from "react";

import {
  initialUpdateSalonSettingsActionState,
} from "@/features/admin/actions/update-salon-settings-action-state";
import { updateSalonSettingsAction } from "@/features/admin/actions/settings-actions";

import {
  SettingsField,
  SettingsFormFooter,
  SettingsFormMessages,
  settingsControlClassName,
  SettingsSection,
} from "./admin-settings-form-ui";

export function AdminSalonSettingsForm({
  settings,
}: {
  settings: {
    salonName: string;
    addressLine: string;
    city: string;
    postalCode: string;
    phone: string;
    contactEmail: string;
    instagramUrl: string | null;
  };
}) {
  const [serverState, formAction] = useActionState(
    updateSalonSettingsAction,
    initialUpdateSalonSettingsActionState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <SettingsFormMessages serverState={serverState} />

      <SettingsSection
        title="Základní údaje"
        description="Krátké veřejné údaje, které má klientka snadno najít."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <SettingsField label="Název salonu" error={serverState.fieldErrors?.salonName}>
            <input
              type="text"
              name="salonName"
              defaultValue={settings.salonName}
              maxLength={120}
              autoComplete="organization"
              className={settingsControlClassName}
            />
          </SettingsField>

          <SettingsField
            label="Telefon"
            hint="Telefon pro dotaz nebo změnu termínu."
            error={serverState.fieldErrors?.phone}
          >
            <input
              type="tel"
              name="phone"
              defaultValue={settings.phone}
              maxLength={32}
              autoComplete="tel"
              inputMode="tel"
              className={settingsControlClassName}
            />
          </SettingsField>

          <SettingsField label="Ulice a číslo" error={serverState.fieldErrors?.addressLine}>
            <input
              type="text"
              name="addressLine"
              defaultValue={settings.addressLine}
              maxLength={160}
              autoComplete="street-address"
              className={settingsControlClassName}
            />
          </SettingsField>

          <SettingsField label="Město" error={serverState.fieldErrors?.city}>
            <input
              type="text"
              name="city"
              defaultValue={settings.city}
              maxLength={120}
              autoComplete="address-level2"
              className={settingsControlClassName}
            />
          </SettingsField>

          <SettingsField label="PSČ" error={serverState.fieldErrors?.postalCode}>
            <input
              type="text"
              name="postalCode"
              defaultValue={settings.postalCode}
              maxLength={6}
              autoComplete="postal-code"
              inputMode="numeric"
              className={settingsControlClassName}
            />
          </SettingsField>

          <SettingsField
            label="Kontaktní e-mail"
            hint="Veřejný e-mail pro dotazy."
            error={serverState.fieldErrors?.contactEmail}
          >
            <input
              type="email"
              name="contactEmail"
              defaultValue={settings.contactEmail}
              maxLength={254}
              autoComplete="email"
              className={settingsControlClassName}
            />
          </SettingsField>

          <div className="md:col-span-2">
            <SettingsField
              label="Instagram"
              hint="Volitelné. Když profil nepoužíváte, nech pole prázdné."
              error={serverState.fieldErrors?.instagramUrl}
            >
              <input
                type="url"
                name="instagramUrl"
                defaultValue={settings.instagramUrl ?? ""}
                maxLength={300}
                autoComplete="url"
                placeholder="https://www.instagram.com/..."
                className={settingsControlClassName}
              />
            </SettingsField>
          </div>
        </div>
      </SettingsSection>

      <SettingsFormFooter note="Po uložení se veřejné kontakty hned promítnou na webu i do e-mailů." />
    </form>
  );
}
