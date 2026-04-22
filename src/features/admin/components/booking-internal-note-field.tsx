"use client";

type BookingInternalNoteFieldProps = {
  clientNote: string;
  onClientNoteChange: (value: string) => void;
  internalNote: string;
  onInternalNoteChange: (value: string) => void;
};

export function BookingInternalNoteField({
  clientNote,
  onClientNoteChange,
  internalNote,
  onInternalNoteChange,
}: BookingInternalNoteFieldProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">
          Poznámka ke rezervaci
        </p>
        <h3 className="mt-2 text-lg font-semibold text-white">Co je důležité pro samotný termín</h3>
        <textarea
          rows={4}
          value={clientNote}
          onChange={(event) => onClientNoteChange(event.target.value)}
          placeholder="Např. klientka chce při návštěvě ještě něco doplnit nebo upřesnit."
          className="mt-4 w-full rounded-[1rem] border border-white/8 bg-black/20 px-3.5 py-3 text-sm leading-5 text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
        />
      </section>

      <section className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">
          G. Interní poznámka
        </p>
        <h3 className="mt-2 text-lg font-semibold text-white">Pouze pro admin / salon</h3>
        <textarea
          rows={4}
          value={internalNote}
          onChange={(event) => onInternalNoteChange(event.target.value)}
          placeholder="Např. rezervace vznikla při odchodu z minulé návštěvy nebo jde o interní výjimku."
          className="mt-4 w-full rounded-[1rem] border border-white/8 bg-black/20 px-3.5 py-3 text-sm leading-5 text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
        />
      </section>
    </div>
  );
}
