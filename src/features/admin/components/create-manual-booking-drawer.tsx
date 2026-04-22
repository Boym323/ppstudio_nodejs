"use client";

import { BookingSource, BookingStatus } from "@prisma/client";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { type AdminArea } from "@/config/navigation";
import {
  initialCreateManualBookingActionState,
} from "@/features/admin/actions/create-manual-booking-action-state";
import { createManualBookingAction } from "@/features/admin/actions/booking-actions";
import { type ReservationsDashboardData } from "@/features/admin/lib/admin-data";
import { BookingClientSelector } from "./booking-client-selector";
import { BookingInternalNoteField } from "./booking-internal-note-field";
import { BookingNotificationOptions } from "./booking-notification-options";
import { BookingServiceSelector } from "./booking-service-selector";
import { BookingSourceField } from "./booking-source-field";
import { BookingTimeSelector } from "./booking-time-selector";

type CreateManualBookingDrawerProps = {
  area: AdminArea;
  data: ReservationsDashboardData["manualBooking"];
};

export function CreateManualBookingDrawer({
  area,
  data,
}: CreateManualBookingDrawerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverState, formAction] = useActionState(
    createManualBookingAction,
    initialCreateManualBookingActionState,
  );
  const [clientQuery, setClientQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [clientProfileNote, setClientProfileNote] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [selectionMode, setSelectionMode] = useState<"slot" | "manual">("slot");
  const [slotId, setSlotId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("");
  const [source, setSource] = useState<BookingSource>(BookingSource.PHONE);
  const [bookingStatus, setBookingStatus] = useState<"PENDING" | "CONFIRMED">(
    BookingStatus.CONFIRMED,
  );
  const [sendClientEmail, setSendClientEmail] = useState(false);
  const [includeCalendarAttachment, setIncludeCalendarAttachment] = useState(true);
  const [clientNote, setClientNote] = useState("");
  const [internalNote, setInternalNote] = useState("");

  const createdBookingHref = serverState.createdBookingId
    ? area === "owner"
      ? `/admin/rezervace/${serverState.createdBookingId}`
      : `/admin/provoz/rezervace/${serverState.createdBookingId}`
    : null;

  useEffect(() => {
    if (serverState.status === "success") {
      router.refresh();
    }
  }, [router, serverState.status]);

  function resetForm() {
    setClientQuery("");
    setSelectedClientId("");
    setFullName("");
    setEmail("");
    setPhone("");
    setClientProfileNote("");
    setServiceSearch("");
    setServiceId("");
    setSelectionMode("slot");
    setSlotId("");
    setStartsAt("");
    setManualDate("");
    setManualTime("");
    setSource(BookingSource.PHONE);
    setBookingStatus(BookingStatus.CONFIRMED);
    setSendClientEmail(false);
    setIncludeCalendarAttachment(true);
    setClientNote("");
    setInternalNote("");
  }

  return (
    <>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
        >
          Přidat rezervaci
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/62 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-4xl overflow-hidden border-l border-white/10 bg-[#131116] shadow-[-20px_0_70px_rgba(0,0,0,0.45)]">
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5 sm:px-6">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-accent-soft)]">
                    Ruční rezervace
                  </p>
                  <h2 className="mt-2 text-2xl font-display text-white">Vytvořit rezervaci v administraci</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/66">
                    Rezervace se ukládá jako běžný `Booking`, jen s admin vstupem a provozními metadaty.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-white/10 px-3 py-2 text-sm text-white/74 transition hover:border-white/18 hover:bg-white/6"
                >
                  Zavřít
                </button>
              </div>

              <form action={formAction} className="flex min-h-0 flex-1 flex-col">
                <input type="hidden" name="area" value={area} />
                <input type="hidden" name="selectionMode" value={selectionMode} />
                <input type="hidden" name="selectedClientId" value={selectedClientId} />
                <input type="hidden" name="serviceId" value={serviceId} />
                <input type="hidden" name="slotId" value={slotId} />
                <input type="hidden" name="startsAt" value={startsAt} />
                <input type="hidden" name="fullName" value={fullName} />
                <input type="hidden" name="email" value={email} />
                <input type="hidden" name="phone" value={phone} />
                <input type="hidden" name="clientProfileNote" value={clientProfileNote} />
                <input type="hidden" name="source" value={source} />
                <input type="hidden" name="bookingStatus" value={bookingStatus} />
                <input type="hidden" name="sendClientEmail" value={sendClientEmail ? "1" : "0"} />
                <input type="hidden" name="includeCalendarAttachment" value={includeCalendarAttachment ? "1" : "0"} />
                <input type="hidden" name="clientNote" value={clientNote} />
                <input type="hidden" name="internalNote" value={internalNote} />

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                  <div className="space-y-4 pb-28">
                    {serverState.status === "success" ? (
                      <div className="rounded-[1rem] border border-emerald-300/18 bg-emerald-500/10 px-4 py-3">
                        <p className="text-sm font-medium text-emerald-50">{serverState.successMessage}</p>
                        {serverState.manualOverrideWarning ? (
                          <p className="mt-2 text-sm leading-6 text-emerald-100/80">{serverState.manualOverrideWarning}</p>
                        ) : null}
                        {createdBookingHref ? (
                          <Link href={createdBookingHref} className="mt-3 inline-flex text-sm font-medium text-white underline underline-offset-4">
                            Otevřít detail rezervace
                          </Link>
                        ) : null}
                      </div>
                    ) : null}

                    {serverState.status === "error" && serverState.formError ? (
                      <div className="rounded-[1rem] border border-red-300/16 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-50">
                        {serverState.formError}
                      </div>
                    ) : null}

                    <BookingClientSelector
                      clients={data.clients}
                      query={clientQuery}
                      onQueryChange={setClientQuery}
                      selectedClientId={selectedClientId}
                      onSelectClient={(clientId) => {
                        setSelectedClientId(clientId);
                        const selectedClient = data.clients.find((client) => client.id === clientId);

                        if (!selectedClient) {
                          return;
                        }

                        setFullName(selectedClient.fullName);
                        setEmail(selectedClient.email);
                        setPhone(selectedClient.phone ?? "");
                        setClientProfileNote(selectedClient.internalNote ?? "");
                      }}
                      onClearSelection={() => {
                        setSelectedClientId("");
                        setFullName("");
                        setEmail("");
                        setPhone("");
                        setClientProfileNote("");
                      }}
                      fullName={fullName}
                      onFullNameChange={setFullName}
                      email={email}
                      onEmailChange={setEmail}
                      phone={phone}
                      onPhoneChange={setPhone}
                      clientProfileNote={clientProfileNote}
                      onClientProfileNoteChange={setClientProfileNote}
                      fieldErrors={serverState.fieldErrors}
                    />

                    <BookingServiceSelector
                      services={data.services}
                      serviceId={serviceId}
                      onServiceIdChange={(value) => {
                        setServiceId(value);
                        setSlotId("");
                        setStartsAt("");
                      }}
                      search={serviceSearch}
                      onSearchChange={setServiceSearch}
                      error={serverState.fieldErrors?.serviceId}
                    />

                    <BookingTimeSelector
                      slots={data.slots}
                      services={data.services}
                      serviceId={serviceId}
                      selectionMode={selectionMode}
                      onSelectionModeChange={setSelectionMode}
                      slotId={slotId}
                      onSlotIdChange={setSlotId}
                      startsAt={startsAt}
                      onStartsAtChange={setStartsAt}
                      manualDate={manualDate}
                      onManualDateChange={setManualDate}
                      manualTime={manualTime}
                      onManualTimeChange={setManualTime}
                      errorSlot={serverState.fieldErrors?.slotId}
                      errorManualDate={serverState.fieldErrors?.manualDate}
                      errorManualTime={serverState.fieldErrors?.manualTime}
                    />

                    {selectionMode === "manual" ? (
                      <>
                        <input type="hidden" name="manualDate" value={manualDate} />
                        <input type="hidden" name="manualTime" value={manualTime} />
                      </>
                    ) : (
                      <>
                        <input type="hidden" name="manualDate" value="" />
                        <input type="hidden" name="manualTime" value="" />
                      </>
                    )}

                    <BookingSourceField
                      source={source}
                      onSourceChange={setSource}
                      bookingStatus={bookingStatus}
                      onBookingStatusChange={setBookingStatus}
                      sourceError={serverState.fieldErrors?.source}
                      statusError={serverState.fieldErrors?.bookingStatus}
                    />

                    <BookingNotificationOptions
                      sendClientEmail={sendClientEmail}
                      onSendClientEmailChange={setSendClientEmail}
                      includeCalendarAttachment={includeCalendarAttachment}
                      onIncludeCalendarAttachmentChange={setIncludeCalendarAttachment}
                    />

                    <BookingInternalNoteField
                      clientNote={clientNote}
                      onClientNoteChange={setClientNote}
                      internalNote={internalNote}
                      onInternalNoteChange={setInternalNote}
                    />
                  </div>
                </div>

                <div className="sticky bottom-0 border-t border-white/10 bg-[#131116]/96 px-5 py-4 backdrop-blur sm:px-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm leading-6 text-white/58">
                      Stejné chování pro OWNER i SALON. Rozdíl je jen v cestě do administrace, ne v logice rezervace.
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          resetForm();
                          setOpen(false);
                        }}
                        className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-white/80 transition hover:border-white/18 hover:bg-white/6"
                      >
                        Zrušit
                      </button>
                      <button
                        type="submit"
                        name="submitMode"
                        value="create"
                        className="rounded-full border border-white/12 bg-white/6 px-4 py-2.5 text-sm font-medium text-white transition hover:border-white/18 hover:bg-white/10"
                      >
                        Vytvořit rezervaci
                      </button>
                      <button
                        type="submit"
                        name="submitMode"
                        value="create-and-send"
                        className="rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-accent-contrast)] transition hover:brightness-105"
                      >
                        Vytvořit a poslat potvrzení
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
