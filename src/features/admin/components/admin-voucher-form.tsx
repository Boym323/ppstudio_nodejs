"use client";

import Link from "next/link";
import { VoucherType } from "@prisma/client";
import { useActionState, useState } from "react";

import {
  createAdminVoucherAction,
} from "@/features/admin/actions/voucher-actions";
import {
  initialCreateVoucherActionState,
} from "@/features/admin/actions/create-voucher-action-state";
import { type AdminVoucherCreatePageData } from "@/features/admin/lib/admin-vouchers";
import { cn } from "@/lib/utils";

type AdminVoucherFormProps = {
  data: AdminVoucherCreatePageData;
};

const czkFormatter = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 0,
  style: "currency",
  currency: "CZK",
});

export function AdminVoucherForm({ data }: AdminVoucherFormProps) {
  const [serverState, formAction, pending] = useActionState(
    createAdminVoucherAction,
    initialCreateVoucherActionState,
  );
  const [type, setType] = useState<VoucherType>(data.initialValues.type);
  const [serviceId, setServiceId] = useState(data.services[0]?.id ?? "");
  const selectedService = data.services.find((service) => service.id === serviceId) ?? null;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="area" value={data.area} />
      <input type="hidden" name="type" value={type} />

      {serverState.status === "error" && serverState.formError ? (
        <div className="rounded-[1.25rem] border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-50">
          {serverState.formError}
        </div>
      ) : null}

      <SectionBlock
        title="Základ voucheru"
        description="Typ, hodnota nebo služba a období, ve kterém půjde voucher použít."
      >
        <div className="grid gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">Typ voucheru</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <TypeButton
                active={type === VoucherType.VALUE}
                label="Hodnotový poukaz"
                onClick={() => setType(VoucherType.VALUE)}
              />
              <TypeButton
                active={type === VoucherType.SERVICE}
                label="Poukaz na službu"
                onClick={() => setType(VoucherType.SERVICE)}
              />
            </div>
            {serverState.fieldErrors?.type ? (
              <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.type}</p>
            ) : null}
          </div>

          {type === VoucherType.VALUE ? (
            <Field label="Hodnota v Kč" error={serverState.fieldErrors?.originalValueCzk}>
              <input
                type="number"
                name="originalValueCzk"
                min={1}
                step={50}
                inputMode="numeric"
                placeholder="Např. 1500"
                className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/32 focus:border-[var(--color-accent)]/60"
              />
            </Field>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr]">
              <Field label="Aktivní služba" error={serverState.fieldErrors?.serviceId}>
                <select
                  name="serviceId"
                  value={serviceId}
                  onChange={(event) => setServiceId(event.target.value)}
                  className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
                >
                  {data.services.length === 0 ? (
                    <option value="" className="text-black">Žádná aktivní služba</option>
                  ) : null}
                  {data.services.map((service) => (
                    <option key={service.id} value={service.id} className="text-black">
                      {service.publicName ?? service.name}
                    </option>
                  ))}
                </select>
              </Field>

              <ServicePreview service={selectedService} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Platnost od" error={serverState.fieldErrors?.validFrom}>
              <input
                type="date"
                name="validFrom"
                required
                defaultValue={data.initialValues.validFrom}
                className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
              />
            </Field>

            <Field label="Platnost do" error={serverState.fieldErrors?.validUntil}>
              <input
                type="date"
                name="validUntil"
                required
                defaultValue={data.initialValues.validUntil}
                className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
              />
            </Field>
          </div>
        </div>
      </SectionBlock>

      <SectionBlock
        title="Kupující / budoucí odeslání e-mailem"
        description="E-mail se zatím jen uloží pro pozdější funkci odeslání voucheru."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kupující jméno" error={serverState.fieldErrors?.purchaserName}>
            <input
              type="text"
              name="purchaserName"
              maxLength={160}
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
            />
          </Field>

          <Field label="Kupující e-mail" error={serverState.fieldErrors?.purchaserEmail}>
            <input
              type="email"
              name="purchaserEmail"
              maxLength={240}
              className="mt-2 w-full rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/60"
            />
          </Field>
        </div>
      </SectionBlock>

      <SectionBlock
        title="Interní poznámka"
        description="Poznámka je viditelná jen v administraci."
      >
        <Field label="Interní poznámka" error={serverState.fieldErrors?.internalNote}>
          <textarea
            name="internalNote"
            rows={5}
            maxLength={2000}
            className="mt-2 w-full resize-y rounded-[1.1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition focus:border-[var(--color-accent)]/60"
          />
        </Field>
      </SectionBlock>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105 disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Vytvářím..." : "Vytvořit voucher"}
        </button>
        <Link
          href={data.listHref}
          className="rounded-full border border-white/10 px-5 py-3 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/6"
        >
          Zpět na seznam
        </Link>
      </div>
    </form>
  );
}

function TypeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[1.1rem] border px-4 py-3 text-left text-sm font-medium transition",
        active
          ? "border-[var(--color-accent)]/60 bg-[rgba(190,160,120,0.16)] text-white"
          : "border-white/10 bg-black/16 text-white/68 hover:border-white/18 hover:bg-white/6",
      )}
    >
      {label}
    </button>
  );
}

function ServicePreview({
  service,
}: {
  service: AdminVoucherCreatePageData["services"][number] | null;
}) {
  if (!service) {
    return (
      <div className="rounded-[1.1rem] border border-dashed border-white/14 bg-white/4 p-4 text-sm leading-6 text-white/56">
        Nejdřív založte nebo aktivujte službu v katalogu.
      </div>
    );
  }

  return (
    <dl className="grid gap-2 rounded-[1.1rem] border border-white/8 bg-white/5 p-4 text-sm">
      <PreviewRow label="Služba" value={service.publicName ?? service.name} />
      <PreviewRow label="Cena" value={service.priceFromCzk === null ? "Neuvedeno" : czkFormatter.format(service.priceFromCzk)} />
      <PreviewRow label="Délka" value={`${service.durationMinutes} min`} />
    </dl>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.18em] text-white/42">{label}</dt>
      <dd className="mt-1 text-white/84">{value}</dd>
    </div>
  );
}

function SectionBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.25rem] border border-white/8 bg-white/5 p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="font-display text-xl text-white">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-white/50">{label}</span>
      {children}
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
    </label>
  );
}
