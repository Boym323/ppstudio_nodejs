"use client";

import { useActionState, useState } from "react";

import {
  initialTestPushoverActionState,
  initialUpdatePushoverSettingsActionState,
} from "@/features/admin/actions/update-pushover-settings-action-state";
import {
  sendPushoverTestAction,
  updatePushoverSettingsAction,
} from "@/features/admin/actions/settings-actions";

import {
  SettingsField,
  SettingsFormFooter,
  SettingsFormMessages,
  SettingsSection,
  SettingsSubmitButton,
  settingsControlClassName,
} from "./admin-settings-form-ui";

type PushoverSettings = {
  pushoverUserKey: string | null;
  pushoverEnabled: boolean;
  notifyNewBooking: boolean;
  notifyBookingPending: boolean;
  notifyBookingConfirmed: boolean;
  notifyBookingCancelled: boolean;
  notifyBookingRescheduled: boolean;
  notifyEmailFailed: boolean;
  notifyReminderFailed: boolean;
  notifySystemErrors: boolean;
};

const bookingToggles = [
  ["notifyNewBooking", "Nová rezervace"],
  ["notifyBookingPending", "Rezervace čeká na potvrzení"],
  ["notifyBookingConfirmed", "Rezervace potvrzena"],
  ["notifyBookingCancelled", "Rezervace zrušena"],
  ["notifyBookingRescheduled", "Termín přesunut"],
] as const;

const systemToggles = [
  ["notifyEmailFailed", "Selhání emailu"],
  ["notifyReminderFailed", "Selhání reminderu"],
  ["notifySystemErrors", "Systémové chyby"],
] as const;

export function AdminPushoverSettingsForm({
  settings,
}: {
  settings: PushoverSettings;
}) {
  const [serverState, formAction] = useActionState(
    updatePushoverSettingsAction,
    initialUpdatePushoverSettingsActionState,
  );
  const [testState, testAction] = useActionState(
    sendPushoverTestAction,
    initialTestPushoverActionState,
  );
  const [dismissedToastMessage, setDismissedToastMessage] = useState<string | null>(null);
  const toastMessage =
    testState.status === "success"
      ? testState.successMessage
      : testState.status === "error"
        ? testState.formError
        : null;
  const visibleToastMessage = toastMessage !== dismissedToastMessage ? toastMessage : null;

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-5">
        <SettingsFormMessages serverState={serverState} />

        <SettingsSection
          title="Pushover notifikace"
          description="Notifikace jsou určené jen pro OWNER účet a slouží k rychlému upozornění na důležité události."
        >
          <div className="space-y-5">
            <ToggleField
              name="pushoverEnabled"
              label="Zapnout Pushover notifikace"
              defaultChecked={settings.pushoverEnabled}
            />

            <SettingsField
              label="Pushover User Key"
              hint="Soukromý klíč příjemce z Pushover účtu. App token zůstává pouze v serverovém ENV."
              error={serverState.fieldErrors?.pushoverUserKey}
            >
              <input
                type="password"
                name="pushoverUserKey"
                defaultValue={settings.pushoverUserKey ?? ""}
                maxLength={128}
                autoComplete="off"
                className={settingsControlClassName}
              />
            </SettingsField>

            <div className="grid gap-4 lg:grid-cols-2">
              <ToggleGroup title="Rezervace" items={bookingToggles} settings={settings} />
              <ToggleGroup title="Systém" items={systemToggles} settings={settings} />
            </div>
          </div>
        </SettingsSection>

        <SettingsFormFooter note="Pushover chyby se jen logují a nikdy nezastaví rezervaci, email ani reminder." />
      </form>

      <form action={testAction} className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4">
        <SettingsFormMessages serverState={testState} />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-white/64">
            Test odešle notifikaci pouze aktuálně přihlášenému OWNEROVI podle uloženého User Key.
          </p>
          <SettingsSubmitButton label="Odeslat testovací notifikaci" />
        </div>
      </form>

      {visibleToastMessage ? (
        <Toast
          message={visibleToastMessage}
          tone={testState.status === "error" ? "error" : "success"}
          onClose={() => setDismissedToastMessage(visibleToastMessage)}
        />
      ) : null}
    </div>
  );
}

function ToggleGroup({
  title,
  items,
  settings,
}: {
  title: string;
  items: readonly (readonly [keyof PushoverSettings, string])[];
  settings: PushoverSettings;
}) {
  return (
    <div className="rounded-[1rem] border border-white/8 bg-black/12 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-3 grid gap-3">
        {items.map(([name, label]) => (
          <ToggleField
            key={name}
            name={name}
            label={label}
            defaultChecked={Boolean(settings[name])}
          />
        ))}
      </div>
    </div>
  );
}

function ToggleField({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-[0.9rem] border border-white/8 bg-white/4 px-4 py-3">
      <span className="text-sm font-medium text-white/82">{label}</span>
      <input
        type="checkbox"
        name={name}
        value="1"
        defaultChecked={defaultChecked}
        className="h-5 w-5 rounded border-white/20 bg-black/30 accent-[var(--color-accent)]"
      />
    </label>
  );
}

function Toast({
  message,
  tone,
  onClose,
}: {
  message: string;
  tone: "success" | "error";
  onClose: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-[1rem] border border-white/10 bg-[#17141b]/95 px-4 py-3 text-sm text-white shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur"
    >
      <span className={tone === "success" ? "text-emerald-300" : "text-red-300"}>
        {tone === "success" ? "Hotovo" : "Pozor"}
      </span>
      <span>{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/72 transition hover:border-white/18 hover:text-white"
      >
        Zavřít
      </button>
    </div>
  );
}
