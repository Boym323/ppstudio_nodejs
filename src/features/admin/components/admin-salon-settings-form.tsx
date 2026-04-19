"use client";

import { useActionState } from "react";

import {
  initialUpdateSalonSettingsActionState,
} from "@/features/admin/actions/update-salon-settings-action-state";
import { updateSalonSettingsAction } from "@/features/admin/actions/settings-actions";

import {
  SettingsField,
  SettingsSection,
  SettingsStatus,
  SettingsSubmitButton,
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
      <SettingsStatus status="success" message={serverState.status === "success" ? serverState.successMessage : undefined} />
      <SettingsStatus status="error" message={serverState.status === "error" ? serverState.formError : undefined} />

      <SettingsSection
        title="Základní údaje"
        description="Tyto údaje se propisují do kontaktních míst webu a do komunikace se zákaznicí."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsField label="Název salonu" error={serverState.fieldErrors?.salonName}>
            <input
              type="text"
              name="salonName"
              defaultValue={settings.salonName}
              maxLength={120}
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
            />
          </SettingsField>

          <SettingsField
            label="Telefon"
            hint="Telefon, na který má klientka volat při dotazu nebo změně termínu."
            error={serverState.fieldErrors?.phone}
          >
            <input
              type="tel"
              name="phone"
              defaultValue={settings.phone}
              maxLength={32}
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
            />
          </SettingsField>

          <SettingsField label="Ulice a číslo" error={serverState.fieldErrors?.addressLine}>
            <input
              type="text"
              name="addressLine"
              defaultValue={settings.addressLine}
              maxLength={160}
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
            />
          </SettingsField>

          <SettingsField label="Město" error={serverState.fieldErrors?.city}>
            <input
              type="text"
              name="city"
              defaultValue={settings.city}
              maxLength={120}
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
            />
          </SettingsField>

          <SettingsField label="PSČ" error={serverState.fieldErrors?.postalCode}>
            <input
              type="text"
              name="postalCode"
              defaultValue={settings.postalCode}
              maxLength={6}
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
            />
          </SettingsField>

          <SettingsField
            label="Kontaktní e-mail"
            hint="Veřejný e-mail pro dotazy klientek."
            error={serverState.fieldErrors?.contactEmail}
          >
            <input
              type="email"
              name="contactEmail"
              defaultValue={settings.contactEmail}
              maxLength={254}
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
            />
          </SettingsField>

          <div className="sm:col-span-2">
            <SettingsField
              label="Instagram"
              hint="Volitelné. Pokud profil nepoužíváte, pole nechte prázdné."
              error={serverState.fieldErrors?.instagramUrl}
            >
              <input
                type="url"
                name="instagramUrl"
                defaultValue={settings.instagramUrl ?? ""}
                maxLength={300}
                placeholder="https://www.instagram.com/..."
                className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
              />
            </SettingsField>
          </div>
        </div>
      </SettingsSection>

      <SettingsSubmitButton />
    </form>
  );
}
