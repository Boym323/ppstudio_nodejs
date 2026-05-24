"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { type AdminArea } from "@/config/navigation";
import { updateClientContactAction } from "@/features/admin/actions/client-actions";
import { initialUpdateClientContactActionState } from "@/features/admin/actions/update-client-contact-action-state";

export function AdminClientContactForm({
  area,
  clientId,
  email,
  phone,
}: {
  area: AdminArea;
  clientId: string;
  email: string;
  phone: string;
}) {
  const [serverState, formAction] = useActionState(
    updateClientContactAction,
    initialUpdateClientContactActionState,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="clientId" value={clientId} />

      {serverState.status === "success" && serverState.successMessage ? (
        <div className="rounded-[0.85rem] border border-emerald-300/14 bg-emerald-400/8 px-2.5 py-1.5 text-xs leading-5 text-emerald-100">
          {serverState.successMessage}
        </div>
      ) : null}

      {serverState.status === "error" && serverState.formError ? (
        <div className="rounded-[0.85rem] border border-red-300/14 bg-red-400/8 px-2.5 py-1.5 text-xs leading-5 text-red-100">
          {serverState.formError}
        </div>
      ) : null}

      <ContactField
        label="E-mail"
        name="email"
        type="email"
        defaultValue={email}
        placeholder="napr. jana@email.cz"
        error={serverState.fieldErrors?.email}
      />

      <ContactField
        label="Telefon"
        name="phone"
        defaultValue={phone}
        placeholder="777 123 456"
        error={serverState.fieldErrors?.phone}
      />

      <SubmitButton />
    </form>
  );
}

function ContactField({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  error,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder: string;
  type?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-[0.12em] text-white/48">{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-[0.75rem] border border-white/8 bg-black/14 px-2.5 py-2 text-sm text-white/92 outline-none transition placeholder:text-white/28 focus:border-white/20"
      />
      {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="rounded-full border border-white/14 bg-transparent px-3.5 py-1.5 text-xs font-medium text-white/78 transition hover:border-white/24 hover:bg-white/7 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
    >
      {pending ? "Ukládám kontakt..." : "Uložit kontakt"}
    </button>
  );
}
