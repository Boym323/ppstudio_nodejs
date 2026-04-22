"use client";

type BookingNotificationOptionsProps = {
  sendClientEmail: boolean;
  onSendClientEmailChange: (value: boolean) => void;
  includeCalendarAttachment: boolean;
  onIncludeCalendarAttachmentChange: (value: boolean) => void;
};

export function BookingNotificationOptions({
  sendClientEmail,
  onSendClientEmailChange,
  includeCalendarAttachment,
  onIncludeCalendarAttachmentChange,
}: BookingNotificationOptionsProps) {
  return (
    <section className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">
        F. Oznámení
      </p>
      <h3 className="mt-2 text-lg font-semibold text-white">Klientský e-mail a kalendář</h3>
      <div className="mt-4 grid gap-2">
        <CheckboxRow
          checked={sendClientEmail}
          label="Poslat potvrzovací e-mail"
          description="Použije se stejné emailové flow jako u běžné rezervace."
          onChange={onSendClientEmailChange}
        />
        <CheckboxRow
          checked={includeCalendarAttachment}
          label="Přidat .ics událost"
          description="U potvrzené rezervace přidá klientce kalendářovou přílohu."
          onChange={onIncludeCalendarAttachmentChange}
          disabled={!sendClientEmail}
        />
      </div>
    </section>
  );
}

function CheckboxRow({
  checked,
  label,
  description,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}>
      <span className="flex items-start gap-3 rounded-[1rem] border border-white/8 bg-black/12 px-3.5 py-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
          className="mt-1 h-4 w-4 rounded border-white/20 bg-black/20 text-[var(--color-accent)]"
        />
        <span>
          <span className="block text-sm font-medium text-white">{label}</span>
          <span className="mt-1 block text-sm leading-5 text-white/62">{description}</span>
        </span>
      </span>
    </label>
  );
}
