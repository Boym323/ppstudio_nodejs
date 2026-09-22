"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { deactivateVoucherTemplateAction } from "@/features/admin/actions/voucher-template-actions";

export function DeactivateVoucherTemplateForm({ templateId }: { templateId: string }) {
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);

    try {
      await deactivateVoucherTemplateAction(templateId);
    } catch (actionError) {
      setError(
        actionError instanceof Error && actionError.message === "Nejprve nastavte jinou publikovanou výchozí šablonu."
          ? actionError.message
          : "Deaktivaci šablony se nepodařilo dokončit.",
      );
    }
  }

  return (
    <form action={submit}>
      {error ? (
        <p role="alert" className="mb-2 max-w-sm text-sm leading-5 text-amber-100">
          {error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl border border-amber-300/40 px-4 py-2 font-semibold text-amber-100 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Deaktivuji…" : "Deaktivovat"}
    </button>
  );
}
