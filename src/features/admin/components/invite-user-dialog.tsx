"use client";

import { useActionState, useEffect, useRef } from "react";

import {
  initialAdminUserAccessActionState,
  type AdminUserAccessActionState,
} from "@/features/admin/actions/update-admin-user-access-action-state";
import { saveAdminUserAccessAction } from "@/features/admin/actions/admin-user-actions";
import { cn } from "@/lib/utils";

type InviteUserDialogProps = {
  open: boolean;
  mode: "invite" | "edit";
  initialValues?: {
    id: string;
    name: string;
    email: string;
    role: "OWNER" | "SALON";
  } | null;
  onClose: () => void;
};

export function InviteUserDialog({
  open,
  mode,
  initialValues,
  onClose,
}: InviteUserDialogProps) {
  const [serverState, formAction] = useActionState(
    saveAdminUserAccessAction,
    initialAdminUserAccessActionState,
  );
  const previousStatus = useRef<AdminUserAccessActionState["status"]>("idle");

  useEffect(() => {
    if (
      previousStatus.current !== "success" &&
      serverState.status === "success"
    ) {
      onClose();
    }

    previousStatus.current = serverState.status;
  }, [onClose, serverState.status]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 top-auto mx-auto max-w-2xl px-4 pb-4 pt-10 sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:-translate-x-1/2 sm:-translate-y-1/2 sm:px-6 sm:pb-0">
        <div className="rounded-[1.7rem] border border-white/10 bg-[#131116] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.45)] sm:p-6">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent-soft)]">
                {mode === "invite" ? "Nový přístup" : "Úprava přístupu"}
              </p>
              <h3 className="mt-2 text-2xl font-display text-white">
                {mode === "invite" ? "Pozvat uživatele" : "Upravit uživatele"}
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/66">
                {mode === "invite"
                  ? "Jednoduché založení přístupu bez složitých oprávnění navíc."
                  : "Upravte jméno a e-mail tak, aby byl přístup v evidenci dobře čitelný."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 px-3 py-2 text-sm text-white/72 transition hover:border-white/18 hover:bg-white/6"
            >
              Zavřít
            </button>
          </div>

          <form action={formAction} className="mt-5 space-y-4">
            <input type="hidden" name="userId" value={initialValues?.id ?? ""} />
            {mode === "edit" ? (
              <input type="hidden" name="role" value={initialValues?.role ?? "SALON"} />
            ) : null}

            {serverState.status === "error" && serverState.formError ? (
              <div className="rounded-[1rem] border border-red-300/16 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-50">
                {serverState.formError}
              </div>
            ) : null}

            <Field
              label="Jméno"
              name="name"
              defaultValue={initialValues?.name ?? ""}
              placeholder="Např. Petra Nováková"
              error={serverState.fieldErrors?.name}
            />

            <Field
              label="E-mail"
              name="email"
              type="email"
              defaultValue={initialValues?.email ?? ""}
              placeholder="napr. petra@ppstudio.cz"
              error={serverState.fieldErrors?.email}
            />

            <label className="block">
              <span className="text-sm font-medium text-white">Role</span>
              <select
                name="role"
                defaultValue={initialValues?.role ?? "SALON"}
                disabled={mode === "edit"}
                className={cn(
                  "mt-2 w-full rounded-[1rem] border border-white/8 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition focus:border-[var(--color-accent)]/55",
                  serverState.fieldErrors?.role ? "border-red-300/40" : "",
                  mode === "edit" ? "cursor-not-allowed opacity-70" : "",
                )}
              >
                <option value="OWNER">OWNER</option>
                <option value="SALON">SALON</option>
              </select>
              {serverState.fieldErrors?.role ? (
                <p className="mt-2 text-sm text-red-300">{serverState.fieldErrors.role}</p>
              ) : (
                <span className="mt-1.5 block text-xs leading-5 text-white/42">
                  {mode === "invite"
                    ? "V systému jsou pouze dvě role: OWNER a SALON."
                    : "Role se mění samostatně přes akci „Změnit roli“ přímo v řádku uživatele."}
                </span>
              )}
            </label>

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6"
              >
                Zrušit
              </button>
              <SubmitButton mode={mode} />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({
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
      <span className="text-sm font-medium text-white">{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={cn(
          "mt-2 w-full rounded-[1rem] border border-white/8 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55",
          error ? "border-red-300/40" : "",
        )}
      />
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
    </label>
  );
}

function SubmitButton({ mode }: { mode: "invite" | "edit" }) {
  return (
    <button
      type="submit"
      className="rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
    >
      {mode === "invite" ? "Odeslat pozvánku" : "Uložit změny"}
    </button>
  );
}
