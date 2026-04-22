"use client";

import { cn } from "@/lib/utils";

type ClientOption = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  internalNote: string | null;
};

type BookingClientSelectorProps = {
  clients: ClientOption[];
  query: string;
  onQueryChange: (value: string) => void;
  selectedClientId: string;
  onSelectClient: (clientId: string) => void;
  onClearSelection: () => void;
  fullName: string;
  onFullNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  clientProfileNote: string;
  onClientProfileNoteChange: (value: string) => void;
  fieldErrors?: Partial<Record<"client" | "fullName" | "email" | "phone", string>>;
};

export function BookingClientSelector({
  clients,
  query,
  onQueryChange,
  selectedClientId,
  onSelectClient,
  onClearSelection,
  fullName,
  onFullNameChange,
  email,
  onEmailChange,
  phone,
  onPhoneChange,
  clientProfileNote,
  onClientProfileNoteChange,
  fieldErrors,
}: BookingClientSelectorProps) {
  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;
  const normalizedQuery = query.trim().toLocaleLowerCase("cs-CZ");
  const matchingClients = normalizedQuery.length === 0
    ? clients.slice(0, 6)
    : clients
        .filter((client) => {
          const haystack = [
            client.fullName,
            client.email,
            client.phone ?? "",
          ]
            .join(" ")
            .toLocaleLowerCase("cs-CZ");

          return haystack.includes(normalizedQuery);
        })
        .slice(0, 6);

  return (
    <section className="rounded-[1.35rem] border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 pb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-soft)]">
            A. Klientka
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">Vyhledat nebo vytvořit profil</h3>
          <p className="mt-1 text-sm leading-6 text-white/62">
            Hledání funguje podle jména, telefonu i e-mailu. Při shodě je lepší propojit existující klientku než zakládat duplicitu.
          </p>
        </div>

        {selectedClient ? (
          <button
            type="button"
            onClick={onClearSelection}
            className="rounded-full border border-white/10 px-3 py-2 text-sm text-white/78 transition hover:border-white/18 hover:bg-white/6"
          >
            Vytvořit novou klientku
          </button>
        ) : null}
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-medium text-white">Najít klientku</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Např. Jana Nováková, 777123456 nebo jana@email.cz"
          className="mt-2 w-full rounded-[1rem] border border-white/8 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
        />
        {fieldErrors?.client ? <p className="mt-2 text-sm text-red-300">{fieldErrors.client}</p> : null}
      </label>

      {selectedClient ? (
        <div className="mt-4 rounded-[1rem] border border-emerald-300/20 bg-emerald-500/10 p-3.5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/80">
            Propojená klientka
          </p>
          <p className="mt-2 text-sm font-semibold text-white">{selectedClient.fullName}</p>
          <p className="mt-1 text-sm text-white/70">
            {selectedClient.email}
            {selectedClient.phone ? ` • ${selectedClient.phone}` : ""}
          </p>
          {selectedClient.internalNote ? (
            <p className="mt-2 text-sm leading-5 text-white/62">{selectedClient.internalNote}</p>
          ) : null}
        </div>
      ) : matchingClients.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {matchingClients.map((client) => {
            const isSelected = selectedClientId === client.id;

            return (
              <button
                key={client.id}
                type="button"
                onClick={() => onSelectClient(client.id)}
                className={cn(
                  "rounded-[1rem] border px-3.5 py-3 text-left transition",
                  isSelected
                    ? "border-[var(--color-accent)]/45 bg-[var(--color-accent)]/10"
                    : "border-white/8 bg-black/12 hover:border-white/14 hover:bg-white/[0.04]",
                )}
              >
                <p className="text-sm font-medium text-white">{client.fullName}</p>
                <p className="mt-1 text-sm text-white/68">
                  {client.email}
                  {client.phone ? ` • ${client.phone}` : ""}
                </p>
              </button>
            );
          })}
        </div>
      ) : query.trim().length > 0 ? (
        <div className="mt-4 rounded-[1rem] border border-dashed border-white/14 bg-white/[0.03] p-3.5 text-sm text-white/62">
          V systému jsme nenašli shodu. Níže můžete rovnou založit novou klientku.
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field
          label="Jméno a příjmení"
          value={fullName}
          onChange={onFullNameChange}
          placeholder="Např. Jana Nováková"
          error={fieldErrors?.fullName}
        />
        <Field
          label="E-mail"
          type="email"
          value={email}
          onChange={onEmailChange}
          placeholder="napr. jana@email.cz"
          error={fieldErrors?.email}
        />
        <Field
          label="Telefon"
          value={phone}
          onChange={onPhoneChange}
          placeholder="+420 777 123 456"
          error={fieldErrors?.phone}
        />
        <label className="block md:col-span-2">
          <span className="text-sm font-medium text-white">Poznámka ke klientce</span>
          <textarea
            rows={3}
            value={clientProfileNote}
            onChange={(event) => onClientProfileNoteChange(event.target.value)}
            placeholder="Např. preferuje kontakt přes SMS nebo už má v historii specifickou domluvu."
            className="mt-2 w-full rounded-[1rem] border border-white/8 bg-black/20 px-3.5 py-3 text-sm leading-5 text-white outline-none transition placeholder:text-white/30 focus:border-[var(--color-accent)]/55"
          />
        </label>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-white">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
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
