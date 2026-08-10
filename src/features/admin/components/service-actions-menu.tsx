"use client";

import Link from "next/link";
import { type ReactNode } from "react";

import { type AdminArea } from "@/config/navigation";
import {
  duplicateServiceAction,
  moveServiceAction,
  toggleServiceActiveAction,
  toggleServiceBookableAction,
} from "@/features/admin/actions/service-actions";
import * as DropdownMenu from "@/components/ui/dropdown-menu";

export function ServiceActionsMenu({
  area,
  serviceId,
  categoryId,
  detailHref,
  returnTo,
  isActive,
  isPubliclyBookable,
}: {
  area: AdminArea;
  serviceId: string;
  categoryId: string;
  detailHref: string;
  returnTo: string;
  isActive: boolean;
  isPubliclyBookable: boolean;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button type="button" aria-label="Akce služby" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-white/10 bg-white/6 text-lg text-white/76 transition hover:border-white/18 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]">
          ⋯
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end">
          <DropdownMenu.Item asChild>
            <Link href={detailHref}>Otevřít detail</Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator />

          <QuickMenuAction action={toggleServiceActiveAction} area={area} serviceId={serviceId} returnTo={returnTo} value={!isActive}>
            {isActive ? "Deaktivovat" : "Aktivovat"}
          </QuickMenuAction>

          <QuickMenuAction action={toggleServiceBookableAction} area={area} serviceId={serviceId} returnTo={returnTo} value={!isPubliclyBookable}>
            {isPubliclyBookable ? "Nastavit jako interní" : "Nastavit jako veřejnou"}
          </QuickMenuAction>

          <QuickMenuAction action={duplicateServiceAction} area={area} serviceId={serviceId} returnTo={returnTo}>
            Duplikovat
          </QuickMenuAction>

          <MoveMenuAction
            area={area}
            categoryId={categoryId}
            direction="up"
            serviceId={serviceId}
            returnTo={returnTo}
          />
          <MoveMenuAction
            area={area}
            categoryId={categoryId}
            direction="down"
            serviceId={serviceId}
            returnTo={returnTo}
          />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function QuickMenuAction({
  action,
  area,
  serviceId,
  returnTo,
  value,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  area: AdminArea;
  serviceId: string;
  returnTo: string;
  value?: boolean;
  children: ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {value === undefined ? null : <input type="hidden" name="value" value={String(value)} />}
      <DropdownMenu.Item asChild>
        <button type="submit">{children}</button>
      </DropdownMenu.Item>
    </form>
  );
}

function MoveMenuAction({
  area,
  serviceId,
  categoryId,
  direction,
  returnTo,
}: {
  area: AdminArea;
  serviceId: string;
  categoryId: string;
  direction: "up" | "down";
  returnTo: string;
}) {
  return (
    <form action={moveServiceAction}>
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="direction" value={direction} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <DropdownMenu.Item asChild>
        <button type="submit">{direction === "up" ? "Posunout výš" : "Posunout níž"}</button>
      </DropdownMenu.Item>
    </form>
  );
}
