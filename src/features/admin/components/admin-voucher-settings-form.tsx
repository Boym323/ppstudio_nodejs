"use client";

import { useActionState } from "react";

import { updateVoucherSettingsAction } from "@/features/admin/actions/settings-actions";
import {
  initialUpdateVoucherSettingsActionState,
} from "@/features/admin/actions/update-voucher-settings-action-state";

import {
  SettingsField,
  SettingsFormFooter,
  SettingsFormMessages,
  settingsControlClassName,
} from "./admin-settings-form-ui";
import { AdminVoucherTemplatePreview } from "./admin-voucher-template-preview";

type VoucherTemplateOption = {
  id: string;
  key: string;
  label: string;
  previewUrl: string;
};

export function AdminVoucherSettingsForm({
  voucherDefaultTemplateId,
  voucherDefaultValidityMonths,
  voucherTemplates,
}: {
  voucherDefaultTemplateId: string | null;
  voucherDefaultValidityMonths: number;
  voucherTemplates: VoucherTemplateOption[];
}) {
  const [serverState, formAction] = useActionState(
    updateVoucherSettingsAction,
    initialUpdateVoucherSettingsActionState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <SettingsFormMessages serverState={serverState} />

      <div className="grid gap-4 md:grid-cols-2">
        <SettingsField
          label="Výchozí vzhled voucheru"
          hint="Nastavení ovlivní pouze nově vytvořené vouchery. Historické vouchery si drží vlastní šablonu."
          error={serverState.fieldErrors?.voucherDefaultTemplateId}
        >
          {voucherTemplates.length === 1 && voucherTemplates[0].id === voucherDefaultTemplateId ? (
            <>
              <input type="hidden" name="voucherDefaultTemplateId" value={voucherTemplates[0].id} />
              <div className="mt-2 overflow-hidden rounded-[1rem] border border-[var(--color-accent)]/45 bg-black/20">
                <AdminVoucherTemplatePreview
                  src={voucherTemplates[0].previewUrl}
                  alt={`Náhled šablony ${voucherTemplates[0].label}`}
                  className="h-auto w-full"
                />
                <p className="border-t border-white/8 px-3 py-2 text-sm text-white/78">{voucherTemplates[0].label}</p>
              </div>
            </>
          ) : (
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {voucherTemplates.map((template) => (
                <label key={template.key} className="cursor-pointer rounded-[1rem] border border-white/10 bg-black/20 p-2 has-[:checked]:border-[var(--color-accent)]/60">
                  <input
                    type="radio"
                    name="voucherDefaultTemplateId"
                    value={template.id}
                    defaultChecked={template.id === voucherDefaultTemplateId}
                    required
                    className="sr-only"
                  />
                  <AdminVoucherTemplatePreview src={template.previewUrl} alt={`Náhled šablony ${template.label}`} className="h-auto w-full rounded-lg" />
                  <span className="mt-2 block px-1 text-sm text-white/82">{template.label}</span>
                </label>
              ))}
            </div>
          )}
        </SettingsField>

        <SettingsField
          label="Výchozí platnost"
          hint="Použije se při vytvoření nového voucheru; povolený rozsah je 1–60 měsíců."
          error={serverState.fieldErrors?.voucherDefaultValidityMonths}
        >
          <div className="mt-2 flex items-center gap-3">
            <input
              type="number"
              name="voucherDefaultValidityMonths"
              min={1}
              max={60}
              step={1}
              defaultValue={voucherDefaultValidityMonths}
              className={settingsControlClassName}
            />
            <span className="shrink-0 text-sm text-white/62">měsíců</span>
          </div>
        </SettingsField>
      </div>

      <SettingsFormFooter note="Výchozí vzhled se uloží ke každému novému voucheru jako přesná template reference." />
    </form>
  );
}
