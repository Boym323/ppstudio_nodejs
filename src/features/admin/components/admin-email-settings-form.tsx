"use client";

import { useActionState } from "react";

import {
  initialUpdateEmailSettingsActionState,
} from "@/features/admin/actions/update-email-settings-action-state";
import { updateEmailSettingsAction } from "@/features/admin/actions/settings-actions";

import {
  SettingsField,
  SettingsFormFooter,
  SettingsFormMessages,
  settingsControlClassName,
  settingsTextareaClassName,
  SettingsSection,
} from "./admin-settings-form-ui";

export function AdminEmailSettingsForm({
  settings,
}: {
  settings: {
    notificationAdminEmail: string;
    emailSenderName: string;
    emailSenderEmail: string;
    emailFooterText: string | null;
  };
}) {
  const [serverState, formAction] = useActionState(
    updateEmailSettingsAction,
    initialUpdateEmailSettingsActionState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <SettingsFormMessages serverState={serverState} />

      <SettingsSection
        title="Komunikace"
        description="Jen to, co běžně potřebuje obsluha salonu."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <SettingsField
            label="E-mail pro upozornění"
            hint="Na tuto adresu chodí oznámení o nové nebo zrušené rezervaci."
            error={serverState.fieldErrors?.notificationAdminEmail}
          >
            <input
              type="email"
              name="notificationAdminEmail"
              defaultValue={settings.notificationAdminEmail}
              maxLength={254}
              autoComplete="email"
              className={settingsControlClassName}
            />
          </SettingsField>

          <SettingsField
            label="Jméno odesílatele"
            hint="Jak se má salon zobrazovat v doručené poště."
            error={serverState.fieldErrors?.emailSenderName}
          >
            <input
              type="text"
              name="emailSenderName"
              defaultValue={settings.emailSenderName}
              maxLength={120}
              autoComplete="organization"
              className={settingsControlClassName}
            />
          </SettingsField>

          <div className="md:col-span-2">
            <SettingsField
              label="E-mail odesílatele"
              hint="Musí odpovídat adrese, kterou umí vaše e-mailová služba odesílat."
              error={serverState.fieldErrors?.emailSenderEmail}
            >
              <input
                type="email"
                name="emailSenderEmail"
                defaultValue={settings.emailSenderEmail}
                maxLength={254}
                autoComplete="email"
                className={settingsControlClassName}
              />
            </SettingsField>
          </div>

          <div className="md:col-span-2">
            <SettingsField
              label="Krátká patička e-mailů"
              hint="Volitelné. Hodí se pro krátkou větu pod potvrzením rezervace."
              error={serverState.fieldErrors?.emailFooterText}
            >
              <textarea
                name="emailFooterText"
                rows={4}
                maxLength={600}
                defaultValue={settings.emailFooterText ?? ""}
                className={settingsTextareaClassName}
              />
            </SettingsField>
          </div>
        </div>
      </SettingsSection>

      <SettingsFormFooter note="Změny tady ovlivní, jak salon vystupuje v potvrzovacích e-mailech a provozních upozorněních." />
    </form>
  );
}
