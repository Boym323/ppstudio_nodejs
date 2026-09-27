"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { deactivateVoucherTemplateAction } from "@/features/admin/actions/voucher-template-actions";

export function DeactivateVoucherTemplateForm({ templateId, compact = false }: { templateId: string; compact?: boolean }) {
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
      <SubmitButton compact={compact} />
    </form>
  );
}

function SubmitButton({ compact }: { compact: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={compact
        ? "w-full rounded-xl px-3 py-2.5 text-left text-sm text-white/65 transition-colors hover:bg-white/8 hover:text-white disabled:cursor-wait disabled:opacity-50"
        : "rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-white/65 transition-colors hover:border-white/25 hover:text-white/85 disabled:cursor-wait disabled:opacity-50"}
    >
      {pending ? "Deaktivuji…" : "Deaktivovat"}
    </button>
  );
}
