"use client";

import Image from "next/image";
import { useActionState } from "react";
import { useState } from "react";

import * as Dialog from "@/components/ui/dialog";

import {
  initialUpdateSalonSettingsActionState,
} from "@/features/admin/actions/update-salon-settings-action-state";
import { updateSalonSettingsAction } from "@/features/admin/actions/settings-actions";

import {
  SettingsField,
  SettingsFormFooter,
  SettingsFormMessages,
  settingsControlClassName,
  settingsSelectClassName,
  SettingsSection,
} from "./admin-settings-form-ui";
import { MediaPicker, type MediaPickerAsset } from "./media-picker";

type PublicMediaOption = MediaPickerAsset & { mimeType: string };

function PublicPhotoField({
  name,
  label,
  emptyLabel,
  initialValue,
  assets,
  error,
}: {
  name: "contactPhotoMediaId" | "homePortraitMediaId" | "aboutPortraitMediaId";
  label: string;
  emptyLabel: string;
  initialValue: string | null;
  assets: PublicMediaOption[];
  error?: string;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const selectedAsset = assets.find((asset) => asset.id === value);

  return (
    <div className="block">
      <span className="text-sm font-medium text-white">{label}</span>
      <input type="hidden" name={name} value={value} />
      <div className="mt-2 flex flex-wrap items-center gap-3 rounded-[1.1rem] border border-white/10 bg-black/20 p-3">
        {selectedAsset ? (
          <>
            <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-black/20">
              {selectedAsset.thumbnailPublicUrl ?? selectedAsset.publicUrl ? (
                <Image
                  src={selectedAsset.thumbnailPublicUrl ?? selectedAsset.publicUrl!}
                  alt={selectedAsset.altText ?? selectedAsset.title ?? selectedAsset.fileName}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              ) : null}
            </div>
            <p className="min-w-0 flex-1 truncate text-sm text-white">
              {selectedAsset.title ?? selectedAsset.fileName}
            </p>
          </>
        ) : (
          <p className="flex-1 text-sm text-white/60">{emptyLabel}</p>
        )}
        <Dialog.Root>
          <Dialog.Trigger asChild>
            <button type="button" className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm text-white">
              Vybrat jiné médium
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay />
            <Dialog.Content className="max-w-5xl rounded-[1.7rem] border border-white/10 bg-[#131116] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.45)] sm:p-6">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <Dialog.Title>{label}</Dialog.Title>
                  <Dialog.Description>Vyberte publikované veřejné médium z Media Library.</Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button type="button" className="min-h-11 min-w-11 rounded-full border border-white/10 px-3 py-2 text-sm text-white/72">Zavřít</button>
                </Dialog.Close>
              </div>
              <div className="mt-5">
                <MediaPicker assets={assets} value={value} onSelect={setValue} />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        {value ? (
          <button type="button" onClick={() => setValue("")} className="min-h-11 rounded-full border border-white/15 px-4 py-2 text-sm text-white/72">
            Odebrat fotografii
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
    </div>
  );
}

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
    voucherPdfLogoMediaId: string | null;
    contactPhotoMediaId: string | null;
    homePortraitMediaId: string | null;
    aboutPortraitMediaId: string | null;
    publishedMediaOptions: PublicMediaOption[];
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

      <SettingsSection title="Fotografie veřejného webu" description="Vyberte již publikované médium z Media Library; soubor se nekopíruje.">
        <div className="space-y-4">
          <PublicPhotoField name="contactPhotoMediaId" label="Kontaktní fotografie" emptyLabel="Bez fotografie" initialValue={settings.contactPhotoMediaId} assets={settings.publishedMediaOptions} error={serverState.fieldErrors?.contactPhotoMediaId} />
          <PublicPhotoField name="homePortraitMediaId" label="Portrét na úvodní stránce" emptyLabel="Bez portrétu" initialValue={settings.homePortraitMediaId} assets={settings.publishedMediaOptions} error={serverState.fieldErrors?.homePortraitMediaId} />
          <PublicPhotoField name="aboutPortraitMediaId" label="Portrét na stránce O mně" emptyLabel="Bez portrétu" initialValue={settings.aboutPortraitMediaId} assets={settings.publishedMediaOptions} error={serverState.fieldErrors?.aboutPortraitMediaId} />
        </div>
      </SettingsSection>

      <SettingsSection
        title="PDF vouchery"
        description="Vizuál dárkového poukazu může mít vlastní značku nezávisle na webu."
      >
        <SettingsField
          label="Logo pro PDF vouchery"
          hint="Použije se pouze v PDF dárkových voucherů. Může se lišit od loga na webu."
          error={serverState.fieldErrors?.voucherPdfLogoMediaId}
        >
          <select
            name="voucherPdfLogoMediaId"
            defaultValue={settings.voucherPdfLogoMediaId ?? ""}
            className={settingsSelectClassName}
          >
            <option value="">Textové logo PP Studio</option>
            {settings.publishedMediaOptions.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.title ?? asset.fileName} · {asset.mimeType}
              </option>
            ))}
          </select>
        </SettingsField>
        <p className="mt-3 rounded-[1rem] border border-white/8 bg-black/10 px-4 py-3 text-sm leading-6 text-white/60">
          {settings.voucherPdfLogoMediaId
            ? "PDF použije vybrané médium, pokud je dostupné jako PNG nebo JPEG. U jiných formátů se bezpečně vrátí k textovému logu."
            : "PDF použije textové logo PP Studio."}
        </p>
      </SettingsSection>

      <SettingsFormFooter note="Po uložení se veřejné kontakty hned promítnou na webu i do e-mailů." />
    </form>
  );
}
