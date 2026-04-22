"use client";

import { useActionState, useEffect, useState } from "react";

import { initialUpdateCalendarFeedActionState } from "@/features/admin/actions/update-calendar-feed-action-state";
import { updateCalendarFeedAction } from "@/features/admin/actions/settings-actions";

import {
  SettingsFormMessages,
  SettingsSection,
  SettingsSubmitButton,
} from "./admin-settings-form-ui";

type AdminCalendarSettingsFormProps = {
  feed: {
    isActive: boolean;
    subscriptionUrl: string | null;
    updatedAtLabel: string;
    rotatedAtLabel: string | null;
    revokedAtLabel: string | null;
    updatedByName: string | null;
  };
};

export function AdminCalendarSettingsForm({ feed }: AdminCalendarSettingsFormProps) {
  const [serverState, formAction] = useActionState(
    updateCalendarFeedAction,
    initialUpdateCalendarFeedActionState,
  );
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (copyState === "idle") {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyState("idle");
    }, 2500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copyState]);

  async function handleCopyClick() {
    if (!feed.subscriptionUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(feed.subscriptionUrl);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  return (
    <div className="space-y-5">
      <SettingsFormMessages serverState={serverState} />

      <SettingsSection
        title="Apple Kalendář subscription"
        description="Read-only `.ics` feed pro majitelku. Aplikace zůstává jediným místem, kde se rezervace potvrzují a upravují."
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatusCard
              label="Stav feedu"
              value={feed.isActive ? "Aktivní" : "Vypnutý"}
              detail={
                feed.isActive
                  ? "Apple Kalendář může odebírat potvrzené rezervace."
                  : "Feed je vypnutý a žádný subscription odkaz teď nefunguje."
              }
            />
            <StatusCard
              label="Poslední změna"
              value={feed.updatedAtLabel}
              detail={feed.updatedByName ? `Naposledy upravil(a): ${feed.updatedByName}` : "Bez přiřazeného uživatele."}
            />
            <StatusCard
              label="Token"
              value={feed.rotatedAtLabel ? "Obnovený" : "Původní"}
              detail={feed.rotatedAtLabel ? `Naposledy obnoven: ${feed.rotatedAtLabel}` : "Zatím nebyla provedena rotace tokenu."}
            />
            <StatusCard
              label="Vypnutí"
              value={feed.revokedAtLabel ? "Proběhlo" : "Nepoužito"}
              detail={feed.revokedAtLabel ? `Naposledy vypnut: ${feed.revokedAtLabel}` : "Feed zatím nebyl ručně vypnutý."}
            />
          </div>

          <div className="rounded-[1.15rem] border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-medium text-white">Subscription odkaz</p>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Tento odkaz vložíš do Apple Kalendáře jako odebíraný kalendář. Po rotaci přestane starý odkaz fungovat.
            </p>
            <div className="mt-3 rounded-[1rem] border border-white/10 bg-black/30 px-4 py-3 text-sm leading-6 text-white/82 break-all">
              {feed.subscriptionUrl ?? "Feed zatím není aktivní. Nejprve ho zapni tlačítkem níže."}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCopyClick}
                disabled={!feed.subscriptionUrl}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Kopírovat odkaz
              </button>
              <p className="text-sm text-white/60">
                {copyState === "copied"
                  ? "Odkaz je ve schránce."
                  : copyState === "error"
                    ? "Odkaz se nepodařilo zkopírovat. Zkus to prosím znovu ručně."
                    : "Na iPhonu nebo Macu vlož URL do Apple Kalendáře jako subscription."}
              </p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <ActionForm
              formAction={formAction}
              intent="activate"
              title={feed.isActive ? "Feed ponechat aktivní" : "Zapnout feed"}
              description={
                feed.isActive
                  ? "Pokud je kalendář aktivní, tlačítko nic nemaže a jen potvrdí, že odkaz může zůstat v provozu."
                  : "Vytvoří nebo znovu zapne subscription feed pro potvrzené rezervace."
              }
              buttonLabel={feed.isActive ? "Feed je aktivní" : "Zapnout kalendář"}
            />

            <ActionForm
              formAction={formAction}
              intent="rotate"
              title="Obnovit token"
              description="Vygeneruje nový bezpečný odkaz. Všechny starší subscription URL přestanou fungovat."
              buttonLabel="Obnovit token"
            />

            <ActionForm
              formAction={formAction}
              intent="deactivate"
              title="Vypnout feed"
              description="Okamžitě zneplatní aktuální odkaz bez mazání rezervací nebo změny databáze."
              buttonLabel="Vypnout feed"
              tone="danger"
            />
          </div>

          <div className="rounded-[1.15rem] border border-white/8 bg-white/4 p-4 text-sm leading-6 text-white/68">
            <p className="font-medium text-white">Jak to použít v Apple Kalendáři</p>
            <p className="mt-2">
              Zkopíruj odkaz, v Apple Kalendáři zvol přidání odebíraného kalendáře z URL a vlož ho beze změn. Kalendář je read-only, takže potvrzení i storna dál děláš jen v aplikaci.
            </p>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}

function StatusCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-[1rem] border border-white/8 bg-white/4 p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-white/40">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm leading-6 text-white/60">{detail}</p>
    </article>
  );
}

function ActionForm({
  formAction,
  intent,
  title,
  description,
  buttonLabel,
  tone = "default",
}: {
  formAction: (payload: FormData) => void;
  intent: "activate" | "rotate" | "deactivate";
  title: string;
  description: string;
  buttonLabel: string;
  tone?: "default" | "danger";
}) {
  return (
    <form action={formAction} className="rounded-[1rem] border border-white/8 bg-white/4 p-4">
      <input type="hidden" name="intent" value={intent} />
      <p className="text-base font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
      <div className="mt-4">
        <SettingsSubmitButton label={buttonLabel} />
      </div>
      {tone === "danger" ? (
        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-red-200/75">
          Okamžitě zneplatní aktuální URL.
        </p>
      ) : null}
    </form>
  );
}
