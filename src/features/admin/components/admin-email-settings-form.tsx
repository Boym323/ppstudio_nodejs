"use client";

import { useActionState } from "react";

import {
  initialUpdateEmailSettingsActionState,
} from "@/features/admin/actions/update-email-settings-action-state";
import { updateEmailSettingsAction } from "@/features/admin/actions/settings-actions";

import {
  SettingsField,
  SettingsSection,
  SettingsStatus,
  SettingsSubmitButton,
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
      <SettingsStatus status="success" message={serverState.status === "success" ? serverState.successMessage : undefined} />
      <SettingsStatus status="error" message={serverState.status === "error" ? serverState.formError : undefined} />

      <SettingsSection
        title="Komunikace"
        description="Držíme jen praktická globální nastavení. Technická SMTP konfigurace zůstává mimo administraci."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingsField
            label="E-mail pro upozornění"
            hint="Na tuto adresu chodí provozní oznámení o nové nebo zrušené rezervaci."
            error={serverState.fieldErrors?.notificationAdminEmail}
          >
            <input
              type="email"
              name="notificationAdminEmail"
              defaultValue={settings.notificationAdminEmail}
              maxLength={254}
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
            />
          </SettingsField>

          <SettingsField
            label="Jméno odesílatele"
            hint="Takto se e-mail zobrazí klientce v doručené poště."
            error={serverState.fieldErrors?.emailSenderName}
          >
            <input
              type="text"
              name="emailSenderName"
              defaultValue={settings.emailSenderName}
              maxLength={120}
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
            />
          </SettingsField>

          <div className="sm:col-span-2">
            <SettingsField
              label="E-mail odesílatele"
              hint="Použijte adresu, kterou vaše e-mailová služba opravdu dovoluje odesílat. V režimu EMAIL_DELIVERY_MODE=background musí odpovídat hodnotě SMTP_FROM_EMAIL."
              error={serverState.fieldErrors?.emailSenderEmail}
            >
              <input
                type="email"
                name="emailSenderEmail"
                defaultValue={settings.emailSenderEmail}
                maxLength={254}
                className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
              />
            </SettingsField>
          </div>

          <div className="sm:col-span-2">
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
                className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition focus:border-[var(--color-accent)]/60"
              />
            </SettingsField>
          </div>
        </div>
      </SettingsSection>

      <SettingsSubmitButton />
    </form>
  );
}
