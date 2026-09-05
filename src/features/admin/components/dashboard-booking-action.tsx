"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import * as Dialog from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { type AdminArea } from "@/config/navigation";
import { getDashboardBookingAction } from "@/features/admin/actions/dashboard-booking-action";
import { type DashboardTodayPlanItem } from "@/features/admin/lib/admin-dashboard";
import { AdminBookingStatusForm } from "./admin-booking-status-form";

export function DashboardBookingAction({ area, item }: { area: AdminArea; item: DashboardTodayPlanItem }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof getDashboardBookingAction>>>(null);
  const requestId = useRef(0);
  const label = item.primaryAction === "CONFIRMED" ? "Potvrdit" : "Dokončit a zaplatit";

  async function load() {
    if (!item.primaryAction) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setData(null);
    setError(null);
    try {
      const result = await getDashboardBookingAction({ area, bookingId: item.id, action: item.primaryAction });
      if (currentRequest !== requestId.current) return;
      setData(result);
      if (!result) setError("Tato akce už není dostupná. Rezervace se mohla mezitím změnit; otevřete její detail.");
    } catch {
      if (currentRequest === requestId.current) setError("Rezervaci se nepodařilo načíst. Zkuste to znovu.");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => {
      setOpen(nextOpen);
      if (nextOpen) void load();
      else requestId.current += 1;
    }}>
      <Dialog.Trigger asChild>
        <button type="button" className="min-h-11 rounded-full border border-[var(--color-accent)]/40 bg-[rgba(190,160,120,0.12)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[rgba(190,160,120,0.22)]">{label}</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content className="rounded-[1.4rem] border border-white/10 bg-[#131116] p-4 shadow-xl sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title>{data?.clientName ?? item.clientName}</Dialog.Title>
              <Dialog.Description>{data ? `${data.scheduledAtLabel} · ${data.serviceName}` : `${item.timeLabel} · ${item.serviceName}`}</Dialog.Description>
            </div>
            <Dialog.Close asChild><button type="button" className="min-h-11 shrink-0 rounded-full border border-white/12 px-3 text-sm text-white/80">Zavřít</button></Dialog.Close>
          </div>
          <div className="mt-4">
            {loading ? <p role="status" className="text-sm text-white/70">Načítám aktuální rezervaci a úhradu…</p> : null}
            {error ? <div role="alert" className="space-y-3 text-sm text-amber-100"><p>{error}</p><button type="button" onClick={() => void load()} className="min-h-11 rounded-full border border-white/15 px-4">Zkusit znovu</button></div> : null}
            {data ? <AdminBookingStatusForm {...data.form} paymentDetailsHref={`${item.href}#booking-voucher`} onSuccess={(message) => {
              setOpen(false);
              toast({ message });
              router.refresh();
            }} /> : null}
          </div>
          <Link href={item.href} className="mt-4 inline-flex min-h-11 items-center text-sm text-[var(--color-accent-soft)] underline underline-offset-4">Otevřít celý detail rezervace</Link>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
