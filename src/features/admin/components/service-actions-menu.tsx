import Link from "next/link";
import { type ReactNode } from "react";

import { type AdminArea } from "@/config/navigation";
import {
  duplicateServiceAction,
  moveServiceAction,
  toggleServiceActiveAction,
  toggleServiceBookableAction,
} from "@/features/admin/actions/service-actions";

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
    <details className="group relative">
      <summary className="flex list-none justify-end [&::-webkit-details-marker]:hidden">
        <span className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/6 text-lg text-white/76 transition hover:border-white/18 hover:bg-white/10">
          ⋯
        </span>
      </summary>

      <div className="absolute right-0 z-20 mt-2 w-56 rounded-[1rem] border border-white/10 bg-[#171419] p-2 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
        <Link
          href={detailHref}
          className="flex rounded-[0.85rem] px-3 py-2 text-sm text-white/84 transition hover:bg-white/6"
        >
          Otevřít detail
        </Link>

        <QuickMenuAction action={toggleServiceActiveAction} area={area} serviceId={serviceId} returnTo={returnTo}>
          {isActive ? "Deaktivovat" : "Aktivovat"}
        </QuickMenuAction>

        <QuickMenuAction action={toggleServiceBookableAction} area={area} serviceId={serviceId} returnTo={returnTo}>
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
      </div>
    </details>
  );
}

function QuickMenuAction({
  action,
  area,
  serviceId,
  returnTo,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  area: AdminArea;
  serviceId: string;
  returnTo: string;
  children: ReactNode;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="area" value={area} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        className="flex w-full rounded-[0.85rem] px-3 py-2 text-left text-sm text-white/84 transition hover:bg-white/6"
      >
        {children}
      </button>
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
      <button
        type="submit"
        className="flex w-full rounded-[0.85rem] px-3 py-2 text-left text-sm text-white/84 transition hover:bg-white/6"
      >
        {direction === "up" ? "Posunout výš" : "Posunout níž"}
      </button>
    </form>
  );
}
